using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TechList.Domain.Entities;
using TechList.Domain.Enums;
using TechList.Infrastructure.Persistence;
using System.Text.Json;

namespace TechList.API.Controllers;

/// <summary>
/// Webhook endpoint cho các cổng thanh toán.
/// Không yêu cầu authentication (webhook từ bên ngoài).
/// </summary>
[ApiController]
[Route("api/webhooks")]
public sealed class PaymentWebhookController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<PaymentWebhookController> _logger;

    public PaymentWebhookController(AppDbContext db, IConfiguration config, ILogger<PaymentWebhookController> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// VNPay IPN (Instant Payment Notification) callback.
    /// VNPay gọi endpoint này khi giao dịch hoàn tất.
    /// </summary>
    [HttpGet("vnpay")]
    public async Task<IActionResult> VnPayCallback([FromQuery] Dictionary<string, string> queryParams)
    {
        _logger.LogInformation("VNPay webhook received: {Params}", JsonSerializer.Serialize(queryParams));

        try
        {
            // 1. Xác thực chữ ký (signature verification)
            var vnpSecureHash = queryParams.GetValueOrDefault("vnp_SecureHash", "");
            var signData = string.Join("&",
                queryParams
                    .Where(kv => kv.Key != "vnp_SecureHash" && kv.Key != "vnp_SecureHashType")
                    .OrderBy(kv => kv.Key)
                    .Select(kv => $"{kv.Key}={kv.Value}"));

            var hashSecret = _config["VNPay:HashSecret"] ?? "";
            var computedHash = HmacSha512(hashSecret, signData);

            if (!string.Equals(computedHash, vnpSecureHash, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("VNPay signature verification failed");
                return Ok(new { RspCode = "97", Message = "Invalid Checksum" });
            }

            // 2. Lấy thông tin giao dịch
            var transactionCode = queryParams.GetValueOrDefault("vnp_TxnRef", "");
            var responseCode = queryParams.GetValueOrDefault("vnp_ResponseCode", "");
            var vnpTransactionNo = queryParams.GetValueOrDefault("vnp_TransactionNo", "");
            var amountStr = queryParams.GetValueOrDefault("vnp_Amount", "0");

            // VNPay trả amount * 100
            var amount = long.Parse(amountStr) / 100;

            // 3. Kiểm tra idempotent — không xử lý 2 lần
            var transaction = await _db.Transactions
                .FirstOrDefaultAsync(x => x.TransactionCode == transactionCode);

            if (transaction == null)
            {
                _logger.LogWarning("Transaction not found: {Code}", transactionCode);
                return Ok(new { RspCode = "01", Message = "Order not found" });
            }

            if (transaction.Status != TransactionStatus.Pending)
            {
                _logger.LogInformation("Transaction already processed: {Code}, Status: {Status}",
                    transactionCode, transaction.Status);
                return Ok(new { RspCode = "02", Message = "Order already confirmed" });
            }

            // 4. Kiểm tra số tiền
            if (transaction.FinalAmount != amount)
            {
                _logger.LogWarning("Amount mismatch: expected {Expected}, got {Actual}",
                    transaction.FinalAmount, amount);
                return Ok(new { RspCode = "04", Message = "Invalid Amount" });
            }

            // 5. Cập nhật trạng thái giao dịch
            var newStatus = responseCode == "00" ? TransactionStatus.Success : TransactionStatus.Failed;
            transaction.Status = newStatus;
            transaction.PaymentGatewayRef = vnpTransactionNo;
            transaction.UpdatedAt = DateTime.UtcNow;

            // Cập nhật status history
            var history = JsonSerializer.Deserialize<List<object>>(transaction.StatusHistory) ?? new List<object>();
            history.Add(new
            {
                status = newStatus,
                timestamp = DateTime.UtcNow,
                note = $"VNPay callback - ResponseCode: {responseCode}"
            });
            transaction.StatusHistory = JsonSerializer.Serialize(history);

            // 6. Nếu thành công, kích hoạt subscription
            if (newStatus == TransactionStatus.Success)
            {
                var package = await _db.ServicePackages.FindAsync(transaction.PackageId);
                if (package != null)
                {
                    var subscription = new Subscription
                    {
                        UserId = transaction.UserId,
                        PackageId = package.Id,
                        StartDate = DateTime.UtcNow,
                        EndDate = DateTime.UtcNow.AddDays(package.DurationDays),
                        Status = SubscriptionStatus.Active,
                        JobPostsUsed = 0
                    };
                    _db.Subscriptions.Add(subscription);
                }
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("VNPay webhook processed: {Code} → {Status}", transactionCode, newStatus);
            return Ok(new { RspCode = "00", Message = "Confirm Success" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing VNPay webhook");
            return Ok(new { RspCode = "99", Message = "Unknown error" });
        }
    }

    /// <summary>HMAC SHA-512 hash cho xác thực VNPay.</summary>
    private static string HmacSha512(string key, string data)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return BitConverter.ToString(hash).Replace("-", "").ToLower();
    }
}

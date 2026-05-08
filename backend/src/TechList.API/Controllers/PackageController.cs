using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TechList.API.Common;
using TechList.Application.Admin.Models;
using TechList.Infrastructure.Persistence;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using TechList.Domain.Entities;
using TechList.Domain.Enums;

namespace TechList.API.Controllers;

/// <summary>
/// Public endpoint cho phép lấy danh sách gói dịch vụ đang hoạt động.
/// </summary>
[ApiController]
[Route("api/packages")]
public sealed class PackageController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public PackageController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    /// <summary>Lấy danh sách gói dịch vụ đang hoạt động (public).</summary>
    [HttpGet("active")]
    public async Task<ActionResult<ApiResponse<List<PackageDto>>>> GetActivePackages(CancellationToken ct)
    {
        var packages = await _db.ServicePackages
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.DisplayOrder)
            .ThenBy(p => p.Price)
            .Select(p => new PackageDto(
                p.Id, p.Name, p.Price, p.MaxJobPosts, p.DurationDays,
                p.Features, p.IsHighlighted, p.AllowFeaturedJob, p.AllowFeaturedCompany, p.IsActive, p.DisplayOrder,
                p.CreatedAt, p.UpdatedAt))
            .ToListAsync(ct);

        return Ok(ApiResponse<List<PackageDto>>.Ok(packages));
    }

    /// <summary>Lấy thông tin gói dịch vụ hiện tại của nhà tuyển dụng.</summary>
    [HttpGet("my-subscription")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<object>>> GetMySubscription(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        var allActive = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.UserId == userId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.IsSelected)
            .ThenByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

        // Auto-expire
        bool changed = false;
        foreach (var s in allActive.ToList())
        {
            if (s.EndDate < DateTime.UtcNow)
            {
                s.Status = SubscriptionStatus.Expired;
                s.IsSelected = false;
                allActive.Remove(s);
                changed = true;
            }
        }
        if (changed) await _db.SaveChangesAsync(ct);

        var current = allActive.FirstOrDefault(s => s.IsSelected) ?? allActive.FirstOrDefault();
        if (current != null && !current.IsSelected)
        {
            current.IsSelected = true;
            await _db.SaveChangesAsync(ct);
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            hasSubscription = current != null,
            subscriptionId = current?.Id,
            packageId = current?.Package.Id,
            packageName = current?.Package.Name,
            maxJobPosts = current?.Package.MaxJobPosts ?? 0,
            jobPostsUsed = current?.JobPostsUsed ?? 0,
            jobPostsRemaining = current == null ? 0 : (current.Package.MaxJobPosts == -1 ? -1 : Math.Max(0, current.Package.MaxJobPosts - current.JobPostsUsed)),
            endDate = current?.EndDate,
            daysRemaining = current == null ? 0 : Math.Max(0, (int)(current.EndDate - DateTime.UtcNow).TotalDays),
            packagePrice = current?.Package.Price ?? 0,
            allowFeaturedJob = current?.Package.AllowFeaturedJob ?? false,
            allowFeaturedCompany = current?.Package.AllowFeaturedCompany ?? false,
            packageFeatures = current?.Package.Features ?? "[]",

            // Danh sách các gói đang sở hữu và còn hạn
            ownedSubscriptions = allActive.Select(s => new {
                s.Id,
                s.PackageId,
                packageName = s.Package.Name,
                s.EndDate,
                s.IsSelected,
                maxJobPosts = s.Package.MaxJobPosts
            }).ToList()
        }));
    }

    [HttpPost("select-subscription/{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<object>>> SelectSubscription(Guid id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        var allActive = await _db.Subscriptions
            .Where(s => s.UserId == userId && s.Status == SubscriptionStatus.Active)
            .ToListAsync(ct);

        var target = allActive.FirstOrDefault(s => s.Id == id);
        if (target == null) return NotFound(ApiResponse<object>.Fail("Không tìm thấy gói dịch vụ hợp lệ hoặc gói đã hết hạn."));

        if (target.EndDate < DateTime.UtcNow)
        {
            target.Status = SubscriptionStatus.Expired;
            target.IsSelected = false;
            await _db.SaveChangesAsync(ct);
            return BadRequest(ApiResponse<object>.Fail("Gói dịch vụ này đã hết hạn."));
        }

        foreach (var s in allActive)
        {
            s.IsSelected = (s.Id == id);
        }

        // Kiểm tra giới hạn tin tuyển dụng khi chuyển gói
        var package = await _db.ServicePackages.FindAsync(new object[] { target.PackageId }, ct);
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.OwnerId == userId, ct);
        if (company != null && package != null && package.MaxJobPosts != -1)
        {
            var activeJobCount = await _db.JobPosts.CountAsync(j => j.CompanyId == company.Id && j.IsActive, ct);
            if (activeJobCount > package.MaxJobPosts)
            {
                var excessJobs = await _db.JobPosts
                    .Where(j => j.CompanyId == company.Id && j.IsActive)
                    .OrderBy(j => j.CreatedAt)
                    .Take(activeJobCount - package.MaxJobPosts)
                    .ToListAsync(ct);

                foreach (var job in excessJobs)
                {
                    job.IsActive = false;
                    job.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<object>.Ok(null!, "Đã chuyển sang gói \"" + package?.Name + "\""));
    }

    /// <summary>Đăng ký gói dịch vụ (Free = tự động kích hoạt, trả phí = placeholder).</summary>
    [HttpPost("register/{packageId:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<object>>> RegisterPackage(
        Guid packageId, [FromQuery] string? paymentMethod, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        var package = await _db.ServicePackages.FindAsync(new object[] { packageId }, ct);
        if (package == null || !package.IsActive)
            return NotFound(ApiResponse<object>.Fail("Gói dịch vụ không tồn tại hoặc đã ngưng hoạt động."));

        // Check if user already has active subscription
        var currentSub = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.UserId == userId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);

        // Count actual job posts from DB
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.OwnerId == userId, ct);
        var actualJobCount = company != null
            ? await _db.JobPosts.CountAsync(j => j.CompanyId == company.Id, ct)
            : 0;

        // For Free package: activate immediately
        if (package.Price == 0)
        {
            if (currentSub != null && currentSub.Package.Price == 0)
                return BadRequest(ApiResponse<object>.Fail("Bạn đã đang sử dụng gói Free."));

            var allActive = await _db.Subscriptions
                .Where(s => s.UserId == userId && s.Status == SubscriptionStatus.Active)
                .ToListAsync(ct);
            
            foreach (var s in allActive)
            {
                s.IsSelected = false;
            }

            var newSub = new Subscription
            {
                UserId = userId!,
                PackageId = package.Id,
                StartDate = DateTime.UtcNow,
                EndDate = DateTime.UtcNow.AddDays(package.DurationDays),
                Status = SubscriptionStatus.Active,
                IsSelected = true,
                JobPostsUsed = actualJobCount
            };
            _db.Subscriptions.Add(newSub);

            // Auto-hide excess jobs when downgrading
            if (company != null && package.MaxJobPosts != -1 && actualJobCount > package.MaxJobPosts)
            {
                var excessJobs = await _db.JobPosts
                    .Where(j => j.CompanyId == company.Id && j.IsActive)
                    .OrderBy(j => j.CreatedAt) // hide oldest first
                    .Take(actualJobCount - package.MaxJobPosts)
                    .ToListAsync(ct);

                foreach (var job in excessJobs)
                {
                    job.IsActive = false;
                    job.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _db.SaveChangesAsync(ct);

            return Ok(ApiResponse<object>.Ok(new { subscriptionId = newSub.Id },
                $"Đã kích hoạt gói \"{package.Name}\" thành công!"));
        }

        // For paid packages: create a pending transaction (placeholder for payment integration)
        var transactionCode = $"TXN-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        var transaction = new Transaction
        {
            TransactionCode = transactionCode,
            UserId = userId!,
            CompanyName = company?.Name ?? "",
            PackageId = package.Id,
            Amount = package.Price,
            DiscountAmount = 0,
            FinalAmount = package.Price,
            PaymentMethod = "Manual",
            Status = TransactionStatus.Pending
        };
        _db.Transactions.Add(transaction);
        await _db.SaveChangesAsync(ct);

        // Nếu là VNPay -> Tạo link thanh toán
        if (paymentMethod == "VNPay")
        {
            transaction.PaymentMethod = "VNPay"; // Cập nhật đúng phương thức

            var vnpay = new TechList.Infrastructure.Payment.VnPayLibrary();
            vnpay.AddRequestData("vnp_Version", "2.1.0");
            vnpay.AddRequestData("vnp_Command", "pay");
            vnpay.AddRequestData("vnp_TmnCode", _config["VNPay:TmnCode"] ?? "");
            vnpay.AddRequestData("vnp_Amount", (transaction.FinalAmount * 100).ToString());
            vnpay.AddRequestData("vnp_CreateDate", DateTime.UtcNow.AddHours(7).ToString("yyyyMMddHHmmss"));
            vnpay.AddRequestData("vnp_CurrCode", "VND");
            vnpay.AddRequestData("vnp_IpAddr", HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1");
            vnpay.AddRequestData("vnp_Locale", "vn");
            vnpay.AddRequestData("vnp_OrderInfo", $"Thanh toan goi dich vu: {package.Name}");
            vnpay.AddRequestData("vnp_OrderType", "other");
            vnpay.AddRequestData("vnp_ReturnUrl", _config["VNPay:ReturnUrl"] ?? "");
            vnpay.AddRequestData("vnp_TxnRef", transactionCode);

            await _db.SaveChangesAsync(ct);

            var paymentUrl = vnpay.CreateRequestUrl(_config["VNPay:BaseUrl"] ?? "", _config["VNPay:HashSecret"] ?? "");

            return Ok(ApiResponse<object>.Ok(new { paymentUrl, transactionCode },
                "Vui lòng thực hiện thanh toán qua VNPay."));
        }

        // For demo/manual: auto-approve (giữ nguyên logic cũ nếu không chọn VNPay)
        transaction.Status = TransactionStatus.Success;
        transaction.UpdatedAt = DateTime.UtcNow;

        // Revoke old subscription
        if (currentSub != null)
        {
            currentSub.Status = SubscriptionStatus.Revoked;
            currentSub.UpdatedAt = DateTime.UtcNow;
        }

        var paidSub = new Subscription
        {
            UserId = userId!,
            PackageId = package.Id,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(package.DurationDays),
            Status = SubscriptionStatus.Active,
            JobPostsUsed = actualJobCount
        };
        _db.Subscriptions.Add(paidSub);

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.Ok(new { subscriptionId = paidSub.Id, transactionCode },
            $"Đã đăng ký gói \"{package.Name}\" thành công!"));
    }

    /// <summary>
    /// Xác minh kết quả thanh toán VNPay từ ReturnUrl và kích hoạt subscription nếu thành công.
    /// Endpoint này được gọi từ frontend sau khi VNPay redirect về.
    /// </summary>
    [HttpPost("verify-vnpay")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyVnPay(
        [FromBody] VnPayVerifyRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var rawQuery = request.RawQuery ?? "";

        // Parse raw query string — giữ nguyên encoding cho việc tính hash
        var rawPairs = rawQuery.Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => {
                var idx = p.IndexOf('=');
                return idx < 0
                    ? new { Key = p, RawValue = "", DecodedValue = "" }
                    : new { Key = Uri.UnescapeDataString(p[..idx]), RawValue = p[(idx+1)..], DecodedValue = Uri.UnescapeDataString(p[(idx+1)..].Replace("+", " ")) };
            })
            .ToList();

        var decoded = rawPairs.ToDictionary(x => x.Key, x => x.DecodedValue);

        // 1. Tính hash từ URL-encoded values gốc (đúng chuẩn VNPay)
        var vnpSecureHash = decoded.GetValueOrDefault("vnp_SecureHash", "");
        var hashSecret = _config["VNPay:HashSecret"] ?? "";

        var signData = string.Join("&",
            rawPairs
                .Where(kv => kv.Key.StartsWith("vnp_") && kv.Key != "vnp_SecureHash" && kv.Key != "vnp_SecureHashType")
                .OrderBy(kv => kv.Key)
                .Select(kv => $"{kv.Key}={kv.RawValue}"));

        using var hmac = new System.Security.Cryptography.HMACSHA512(System.Text.Encoding.UTF8.GetBytes(hashSecret));
        var computedBytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(signData));
        var computedHash = BitConverter.ToString(computedBytes).Replace("-", "").ToLower();

        if (!string.Equals(computedHash, vnpSecureHash, StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse<object>.Fail($"Chữ ký không hợp lệ. signData=[{signData}]"));

        // 2. Kiểm tra response code
        var responseCode = decoded.GetValueOrDefault("vnp_ResponseCode", "");
        if (responseCode != "00")
            return BadRequest(ApiResponse<object>.Fail($"Thanh toán không thành công (Mã: {responseCode})."));

        // 3. Tìm transaction
        var transactionCode = decoded.GetValueOrDefault("vnp_TxnRef", "");
        var transaction = await _db.Transactions
            .Include(t => t.Package)
            .FirstOrDefaultAsync(t => t.TransactionCode == transactionCode && t.UserId == userId, ct);

        if (transaction == null)
            return NotFound(ApiResponse<object>.Fail($"Không tìm thấy giao dịch: {transactionCode}"));

        // 4. Idempotent — nếu đã xử lý rồi thì trả về OK luôn
        if (transaction.Status == TransactionStatus.Success)
            return Ok(ApiResponse<object>.Ok(null!, "Gói dịch vụ đã được kích hoạt trước đó."));

        if (transaction.Status != TransactionStatus.Pending)
            return BadRequest(ApiResponse<object>.Fail("Giao dịch ở trạng thái không hợp lệ."));

        // 5. Kích hoạt subscription
        var package = transaction.Package;

        var allActive = await _db.Subscriptions
            .Where(s => s.UserId == userId && s.Status == SubscriptionStatus.Active)
            .ToListAsync(ct);
        
        foreach (var s in allActive)
        {
            s.IsSelected = false;
        }

        var company = await _db.Companies.FirstOrDefaultAsync(c => c.OwnerId == userId, ct);
        var actualJobCount = company != null
            ? await _db.JobPosts.CountAsync(j => j.CompanyId == company.Id, ct)
            : 0;

        var newSub = new Subscription
        {
            UserId = userId!,
            PackageId = package.Id,
            TransactionId = transaction.Id,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(package.DurationDays),
            Status = SubscriptionStatus.Active,
            IsSelected = true,
            JobPostsUsed = actualJobCount
        };
        _db.Subscriptions.Add(newSub);

        transaction.Status = TransactionStatus.Success;
        transaction.PaymentGatewayRef = decoded.GetValueOrDefault("vnp_TransactionNo", "");
        transaction.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.Ok(new { subscriptionId = newSub.Id },
            $"Gói \"{package.Name}\" đã được kích hoạt thành công!"));
    }

    /// <summary>Lấy danh sách lịch sử giao dịch của nhà tuyển dụng.</summary>
    [HttpGet("my-transactions")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<List<TransactionDto>>>> GetMyTransactions(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

        var transactions = await _db.Transactions
            .AsNoTracking()
            .Include(t => t.Package)
            .Include(t => t.Coupon)
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TransactionDto(
                t.Id, t.TransactionCode, t.UserId, "",
                t.CompanyName, t.PackageId, t.Package.Name, t.Package.DurationDays,
                t.Amount, t.DiscountAmount, t.FinalAmount,
                t.Coupon != null ? t.Coupon.Code : null,
                t.PaymentMethod, t.Status, DateTime.SpecifyKind(t.CreatedAt, DateTimeKind.Utc)))
            .ToListAsync(ct);

        return Ok(ApiResponse<List<TransactionDto>>.Ok(transactions));
    }
}

public sealed record VnPayVerifyRequest(string RawQuery);

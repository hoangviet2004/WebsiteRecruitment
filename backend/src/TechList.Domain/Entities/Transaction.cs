namespace TechList.Domain.Entities;

/// <summary>Giao dịch thanh toán.</summary>
public class Transaction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã giao dịch duy nhất (idempotent key).</summary>
    public string TransactionCode { get; set; } = default!;

    /// <summary>Người mua (Nhà tuyển dụng).</summary>
    public string UserId { get; set; } = default!;

    /// <summary>Tên công ty (snapshot tại thời điểm mua).</summary>
    public string CompanyName { get; set; } = string.Empty;

    /// <summary>Gói dịch vụ đã mua.</summary>
    public Guid PackageId { get; set; }

    /// <summary>Số tiền gốc (VND).</summary>
    public long Amount { get; set; }

    /// <summary>Số tiền giảm giá (VND).</summary>
    public long DiscountAmount { get; set; }

    /// <summary>Số tiền thực thanh toán (VND).</summary>
    public long FinalAmount { get; set; }

    /// <summary>Mã giảm giá đã áp dụng (nếu có).</summary>
    public Guid? CouponId { get; set; }

    /// <summary>Phương thức thanh toán: VNPay, Momo, Stripe, Manual.</summary>
    public string PaymentMethod { get; set; } = Enums.PaymentMethod.VNPay;

    /// <summary>Trạng thái: Pending, Success, Failed, Refunded.</summary>
    public string Status { get; set; } = Enums.TransactionStatus.Pending;

    /// <summary>Mã tham chiếu từ cổng thanh toán.</summary>
    public string? PaymentGatewayRef { get; set; }

    /// <summary>Lịch sử trạng thái (JSON array of {status, timestamp, note}).</summary>
    public string StatusHistory { get; set; } = "[]";

    /// <summary>Lý do hoàn tiền (nếu có).</summary>
    public string? RefundReason { get; set; }

    /// <summary>Người thực hiện hoàn tiền (Admin UserId).</summary>
    public string? RefundedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ServicePackage Package { get; set; } = default!;
    public Coupon? Coupon { get; set; }
}

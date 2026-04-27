namespace TechList.Domain.Entities;

/// <summary>Mã giảm giá (Coupon / Voucher).</summary>
public class Coupon
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Mã giảm giá (VD: SALE20, WELCOME50K).</summary>
    public string Code { get; set; } = default!;

    /// <summary>Loại giảm giá: Percentage hoặc FixedAmount.</summary>
    public string DiscountType { get; set; } = Enums.DiscountType.Percentage;

    /// <summary>Giá trị giảm. Nếu Percentage: 10 = 10%. Nếu FixedAmount: 50000 = 50.000đ.</summary>
    public long DiscountValue { get; set; }

    /// <summary>Số lần sử dụng tối đa. 0 = không giới hạn.</summary>
    public int MaxUsageCount { get; set; }

    /// <summary>Số lần đã sử dụng.</summary>
    public int CurrentUsageCount { get; set; }

    /// <summary>Ngày hết hạn.</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Áp dụng cho gói nào (JSON array of PackageId). Rỗng = tất cả.</summary>
    public string ApplicablePackageIds { get; set; } = "[]";

    /// <summary>Trạng thái hoạt động.</summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

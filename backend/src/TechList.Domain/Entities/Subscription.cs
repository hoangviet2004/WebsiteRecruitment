namespace TechList.Domain.Entities;

/// <summary>Gói dịch vụ đang được sử dụng bởi Nhà tuyển dụng.</summary>
public class Subscription
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Nhà tuyển dụng đang dùng gói này.</summary>
    public string UserId { get; set; } = default!;

    /// <summary>Gói dịch vụ đã đăng ký.</summary>
    public Guid PackageId { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    /// <summary>Active / Expired / Revoked.</summary>
    public string Status { get; set; } = Enums.SubscriptionStatus.Active;

    /// <summary>Số tin tuyển dụng đã dùng trong kỳ hiện tại.</summary>
    public int JobPostsUsed { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ServicePackage Package { get; set; } = default!;
}

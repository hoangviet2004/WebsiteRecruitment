namespace TechList.Domain.Entities;

/// <summary>Nhật ký thao tác quan trọng (Audit Log).</summary>
public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Hành động: Refund, RevokeSubscription, ExtendSubscription, etc.</summary>
    public string Action { get; set; } = default!;

    /// <summary>Loại entity: Transaction, Subscription, Package, Coupon.</summary>
    public string EntityType { get; set; } = default!;

    /// <summary>ID của entity liên quan.</summary>
    public string EntityId { get; set; } = default!;

    /// <summary>Người thực hiện (Admin UserId).</summary>
    public string PerformedBy { get; set; } = default!;

    /// <summary>Chi tiết bổ sung (JSON).</summary>
    public string? Details { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

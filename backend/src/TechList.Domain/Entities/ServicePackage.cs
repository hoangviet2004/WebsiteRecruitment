namespace TechList.Domain.Entities;

/// <summary>Gói dịch vụ dành cho Nhà tuyển dụng.</summary>
public class ServicePackage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tên gói: Free, Basic, Pro, Premium.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Giá gói (VND) — lưu integer, không dùng float.</summary>
    public long Price { get; set; }

    /// <summary>Số tin đăng tối đa mỗi tháng. -1 = không giới hạn.</summary>
    public int MaxJobPosts { get; set; }

    /// <summary>Thời hạn gói (ngày).</summary>
    public int DurationDays { get; set; } = 30;

    /// <summary>Danh sách tính năng kèm theo (JSON array of strings).</summary>
    public string Features { get; set; } = "[]";

    /// <summary>Đánh dấu gói nổi bật hiển thị trên trang chủ.</summary>
    public bool IsHighlighted { get; set; }

    /// <summary>Trạng thái hoạt động (active/inactive).</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Thứ tự hiển thị.</summary>
    public int DisplayOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

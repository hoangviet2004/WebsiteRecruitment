namespace TechList.Domain.Entities;

public class SavedJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>FK → AspNetUsers.Id</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>FK → JobPosts.Id</summary>
    public Guid JobPostId { get; set; }

    /// <summary>Collection label: "Tất cả" (default) | "Muốn apply" | "Đang cân nhắc"</summary>
    public string Collection { get; set; } = "Tất cả";

    public DateTime SavedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public JobPost JobPost { get; set; } = default!;
}

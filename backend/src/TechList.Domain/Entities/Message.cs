namespace TechList.Domain.Entities;

public class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Tin nhắn gắn với đơn ứng tuyển cụ thể
    public Guid ApplicationId { get; set; }

    public string SenderId { get; set; } = default!;

    public string Content { get; set; } = string.Empty;

    // "message" | "email"
    public string Type { get; set; } = "message";

    public bool IsRead { get; set; } = false;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public JobApplication Application { get; set; } = default!;
}

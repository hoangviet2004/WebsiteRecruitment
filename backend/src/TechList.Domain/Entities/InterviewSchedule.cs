namespace TechList.Domain.Entities;

public class InterviewSchedule
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ApplicationId { get; set; }

    public DateTime ScheduledAt { get; set; }

    public int DurationMinutes { get; set; } = 60;

    public string? MeetingLink { get; set; }

    public string? Location { get; set; }

    public string? Notes { get; set; }

    // "Scheduled" | "Completed" | "Cancelled"
    public string Status { get; set; } = "Scheduled";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public JobApplication Application { get; set; } = default!;
}

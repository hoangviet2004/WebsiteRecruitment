namespace TechList.Domain.Entities;

public class Offer
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ApplicationId { get; set; }

    public string RecruiterId { get; set; } = default!;

    public decimal? Salary { get; set; }

    public DateTime? StartDate { get; set; }

    public DateTime? ResponseDeadline { get; set; }

    public string? Notes { get; set; }

    // "Pending" | "Accepted" | "Declined" | "Negotiating"
    public string Status { get; set; } = "Pending";

    public string? DeclineReason { get; set; }

    public DateTime? RespondedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public JobApplication Application { get; set; } = default!;
}

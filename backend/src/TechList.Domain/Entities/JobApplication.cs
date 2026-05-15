namespace TechList.Domain.Entities;

public class JobApplication
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid JobPostId { get; set; }
    public string CandidateId { get; set; } = default!;

    // Applied, Screening, Interview, Offered, Hired, Rejected
    public string Status { get; set; } = "Applied";

    public string? CoverLetter { get; set; }

    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public JobPost JobPost { get; set; } = default!;
}

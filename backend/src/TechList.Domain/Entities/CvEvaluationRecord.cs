namespace TechList.Domain.Entities;

public class CvEvaluationRecord
{
    public Guid Id            { get; set; } = Guid.NewGuid();
    public Guid ApplicationId { get; set; }

    public int    Score          { get; set; }
    public string Summary        { get; set; } = string.Empty;
    public string Strengths      { get; set; } = "[]"; // JSON array
    public string Weaknesses     { get; set; } = "[]"; // JSON array
    public string Recommendation { get; set; } = string.Empty;
    public string Details        { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public JobApplication Application { get; set; } = default!;
}

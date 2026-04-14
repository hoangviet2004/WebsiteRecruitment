namespace TechList.Domain.Entities;

public class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // User (Recruiter) that created and owns this company profile
    public string OwnerId { get; set; } = default!;

    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    
    // Logo Information
    public string? LogoUrl { get; set; }
    public string? LogoPublicId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<JobPost> Jobs { get; set; } = new List<JobPost>();
}

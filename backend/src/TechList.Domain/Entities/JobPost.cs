namespace TechList.Domain.Entities;

public class JobPost
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // Which company this job belongs to
    public Guid CompanyId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Requirements { get; set; } = string.Empty;
    public string Benefits { get; set; } = string.Empty;

    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }
    
    public string Location { get; set; } = string.Empty;
    
    // e.g. Full-time, Part-time, Remote, Hybrid
    public string JobType { get; set; } = default!;

    public string? Experience { get; set; }
    public string? Education { get; set; }
    public int? ApplicationLimit { get; set; }
    public bool IsFeatured { get; set; } = false;
    public string? FeaturedLevel { get; set; } // e.g. Silver, Gold

    public DateTime ExpiresAt { get; set; } 
    public bool IsActive { get; set; } = true;
    public bool IsApproved { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Company Company { get; set; } = default!;
}

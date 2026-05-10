using System.ComponentModel.DataAnnotations;

namespace TechList.Domain.Entities;

public class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string OwnerId { get; set; } = default!;

    [MaxLength(100)] public string Name { get; set; } = string.Empty;
    [MaxLength(2000)] public string Description { get; set; } = string.Empty;
    [MaxLength(200)] public string Website { get; set; } = string.Empty;
    [MaxLength(20)] public string TaxCode { get; set; } = string.Empty;
    [MaxLength(200)] public string Address { get; set; } = string.Empty;

    public string? CompanySize { get; set; }

    [MaxLength(100)] public string? ContactEmail { get; set; }
    [MaxLength(20)] public string? ContactPhone { get; set; }

    // Logo Information
    public string? LogoUrl { get; set; }
    public string? LogoPublicId { get; set; }

    public string? CoverImageUrl { get; set; }
    public string? CoverImagePublicId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Status flag for admin control
    public bool IsBlocked { get; set; } = false;

    // Navigation properties
    public ICollection<JobPost> Jobs { get; set; } = new List<JobPost>();
}

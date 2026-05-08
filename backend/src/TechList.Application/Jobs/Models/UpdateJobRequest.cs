using System.ComponentModel.DataAnnotations;

namespace TechList.Application.Jobs.Models;

public sealed class UpdateJobRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Requirements { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Benefits { get; set; } = string.Empty;

    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }

    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    [MaxLength(50)]
    public string JobType { get; set; } = "Full-time";

    [MaxLength(100)]
    public string? Experience { get; set; }

    [MaxLength(100)]
    public string? Education { get; set; }

    public DateTime ExpiresAt { get; set; }
    
    public bool IsActive { get; set; } = true;
}

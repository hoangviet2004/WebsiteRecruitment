namespace TechList.Domain.Entities;

public class UserProfile
{
    public string UserId { get; set; } = default!;

    public string DisplayName { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }
    public string? AvatarPublicId { get; set; }

    public string? CvUrl { get; set; }
    public string? CvPublicId { get; set; }
    public string? Skills { get; set; }
    public string? Experience { get; set; }

    public bool IsApproved { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}


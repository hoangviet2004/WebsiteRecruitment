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
    // JSON: [{"name":"React","level":"expert"}, ...]
    public string? Skills { get; set; }

    // JSON: [{"company":"...","position":"...","from":"2021-05","to":null,"current":true,"desc":"..."}]
    public string? Experience { get; set; }

    // JSON: [{"degree":"...","school":"...","from":"2013","to":"2017","gpa":"3.6"}]
    public string? Education { get; set; }

    // JSON: {"linkedin":"...","github":"...","portfolio":"..."}
    public string? SocialLinks { get; set; }

    public string? Phone { get; set; }
    public string? Location { get; set; }

    // "Seeking" | "Open" | "NotSeeking"
    public string? JobStatus { get; set; } = "Seeking";

    public bool IsApproved { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}


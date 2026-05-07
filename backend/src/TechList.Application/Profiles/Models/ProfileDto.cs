namespace TechList.Application.Profiles.Models;

public sealed record ProfileDto(
    string UserId,
    string DisplayName,
    string Bio,
    string? AvatarUrl,
    string? CvUrl,
    string? Skills,       // JSON array
    string? Experience,   // JSON array
    string? Education,    // JSON array
    string? SocialLinks,  // JSON object
    string? Phone,
    string? Location,
    string? JobStatus
);

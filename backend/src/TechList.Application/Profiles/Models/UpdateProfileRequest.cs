namespace TechList.Application.Profiles.Models;

public sealed record UpdateProfileRequest(
    string DisplayName,
    string? Bio,
    string? Skills,
    string? Experience,
    string? Education,
    string? SocialLinks,
    string? Phone,
    string? Location,
    string? JobStatus
);

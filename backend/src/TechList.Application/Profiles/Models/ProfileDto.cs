namespace TechList.Application.Profiles.Models;

public sealed record ProfileDto(
    string UserId,
    string DisplayName,
    string Bio,
    string? AvatarUrl,
    string? CvUrl,
    string? Skills,
    string? Experience
);


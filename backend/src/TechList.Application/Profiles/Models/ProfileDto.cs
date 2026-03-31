namespace TechList.Application.Profiles.Models;

public sealed record ProfileDto(
    string UserId,
    string DisplayName,
    string Bio,
    string? AvatarUrl
);


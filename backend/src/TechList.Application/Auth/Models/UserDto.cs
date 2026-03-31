namespace TechList.Application.Auth.Models;

public sealed record UserDto(
    string Id,
    string Email,
    string DisplayName,
    string? AvatarUrl,
    IReadOnlyList<string> Roles
);


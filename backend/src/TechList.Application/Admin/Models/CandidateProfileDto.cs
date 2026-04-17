namespace TechList.Application.Admin.Models;

public sealed record CandidateProfileDto(
    string UserId,
    string Email,
    string FullName,
    string DisplayName,
    string Bio,
    string? AvatarUrl,
    bool IsApproved,
    string Provider,
    DateTime CreatedAt
);

namespace TechList.Application.Profiles.Models;

public sealed record UpdateProfileRequest(
    string DisplayName, 
    string? Bio,
    string? Skills,
    string? Experience
);


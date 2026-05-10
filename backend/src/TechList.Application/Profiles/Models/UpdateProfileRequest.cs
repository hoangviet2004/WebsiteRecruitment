using System.ComponentModel.DataAnnotations;

namespace TechList.Application.Profiles.Models;

public sealed record UpdateProfileRequest(
    [MaxLength(50)]  string DisplayName,
    [MaxLength(500)] string? Bio,
    string? Skills,
    string? Experience,
    string? Education,
    string? SocialLinks,
    [MaxLength(20)]  string? Phone,
    [MaxLength(100)] string? Location,
    string? JobStatus
);

namespace TechList.Application.SavedJobs.Models;

public sealed record SavedJobDto(
    Guid SavedJobId,
    Guid JobPostId,
    string Title,
    string CompanyName,
    string? CompanyLogo,
    decimal? MinSalary,
    decimal? MaxSalary,
    string Location,
    string JobType,
    string? Experience,
    string Requirements,
    string Benefits,
    DateTime ExpiresAt,
    string Collection,
    DateTime SavedAt
);

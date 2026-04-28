namespace TechList.Application.Jobs.Models;

public sealed record JobDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string? CompanyLogo,
    string Title,
    string Description,
    string Requirements,
    string Benefits,
    decimal? MinSalary,
    decimal? MaxSalary,
    string Location,
    string JobType,
    string? Experience,
    string? Education,
    DateTime ExpiresAt,
    bool IsActive,
    bool IsApproved,
    DateTime CreatedAt
);

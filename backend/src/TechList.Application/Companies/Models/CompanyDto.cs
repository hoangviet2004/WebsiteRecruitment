namespace TechList.Application.Companies.Models;

public sealed record CompanyDto(
    Guid Id,
    string OwnerId,
    string Name,
    string Description,
    string Website,
    string Address,
    string? CompanySize,
    string? LogoUrl,
    bool IsBlocked,
    DateTime CreatedAt,
    string TaxCode
);

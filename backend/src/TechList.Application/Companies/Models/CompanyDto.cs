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
    string? CoverImageUrl,
    bool IsBlocked,
    DateTime CreatedAt,
    string TaxCode,
    string? ContactEmail,
    string? ContactPhone,
    bool IsFeatured = false,
    string? FeaturedLevel = null
);

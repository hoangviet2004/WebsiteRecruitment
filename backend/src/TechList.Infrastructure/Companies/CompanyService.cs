using Microsoft.EntityFrameworkCore;
using TechList.Application.Companies.Interfaces;
using TechList.Application.Companies.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Companies;

public sealed class CompanyService : ICompanyService
{
    private readonly AppDbContext _db;

    public CompanyService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<CompanyDto>> GetAllCompaniesAsync(CancellationToken ct)
    {
        var companies = await _db.Companies
            .AsNoTracking()
            .ToListAsync(ct);

        return companies.Select(c => new CompanyDto(
            c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, c.LogoUrl, c.IsBlocked, c.CreatedAt, c.TaxCode)).ToList();
    }

    public async Task<CompanyDto> GetCompanyByIdAsync(Guid id, CancellationToken ct)
    {
        var c = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (c is null)
            throw new InvalidOperationException("Company not found");

        return new CompanyDto(c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, c.LogoUrl, c.IsBlocked, c.CreatedAt, c.TaxCode);
    }

    public async Task<CompanyDto> GetMyCompanyAsync(string userId, CancellationToken ct)
    {
        var c = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.OwnerId == userId, ct);

        if (c is null)
            throw new InvalidOperationException("You do not have a company profile yet.");

        return new CompanyDto(c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, c.LogoUrl, c.IsBlocked, c.CreatedAt, c.TaxCode);
    }

    public async Task<CompanyDto> CreateCompanyAsync(string userId, CreateCompanyRequest request, CancellationToken ct)
    {
        var existing = await _db.Companies.AnyAsync(x => x.OwnerId == userId, ct);
        if (existing)
            throw new InvalidOperationException("You already have a company. Please update your existing company instead of creating a new one.");

        var company = new Company
        {
            Id = Guid.NewGuid(),
            OwnerId = userId,
            Name = request.Name,
            Description = request.Description ?? string.Empty,
            Website = request.Website ?? string.Empty,
            Address = request.Address ?? string.Empty,
            CompanySize = request.CompanySize,
            TaxCode = request.TaxCode,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Companies.Add(company);
        await _db.SaveChangesAsync(ct);

        // Auto-create Free subscription for the new recruiter
        var freePackage = await _db.ServicePackages
            .FirstOrDefaultAsync(p => p.Price == 0 && p.IsActive, ct);
        if (freePackage != null)
        {
            var existingSub = await _db.Subscriptions
                .AnyAsync(s => s.UserId == userId && s.Status == Domain.Enums.SubscriptionStatus.Active, ct);
            if (!existingSub)
            {
                _db.Subscriptions.Add(new Subscription
                {
                    UserId = userId,
                    PackageId = freePackage.Id,
                    StartDate = DateTime.UtcNow,
                    EndDate = DateTime.UtcNow.AddDays(freePackage.DurationDays),
                    Status = Domain.Enums.SubscriptionStatus.Active,
                    JobPostsUsed = 0
                });
                await _db.SaveChangesAsync(ct);
            }
        }

        return new CompanyDto(company.Id, company.OwnerId, company.Name, company.Description, company.Website, company.Address, company.CompanySize, company.LogoUrl, company.IsBlocked, company.CreatedAt, company.TaxCode);
    }

    public async Task<CompanyDto> UpdateCompanyAsync(string userId, Guid companyId, UpdateCompanyRequest request, CancellationToken ct)
    {
        var company = await _db.Companies.AsTracking().FirstOrDefaultAsync(x => x.Id == companyId, ct);
        if (company is null)
            throw new InvalidOperationException("Company not found");

        if (company.OwnerId != userId)
            throw new UnauthorizedAccessException("You can only update your own company.");

        company.Name = request.Name;
        company.Description = request.Description ?? string.Empty;
        company.Website = request.Website ?? string.Empty;
        company.Address = request.Address ?? string.Empty;
        company.CompanySize = request.CompanySize;
        company.TaxCode = request.TaxCode;
        company.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new CompanyDto(company.Id, company.OwnerId, company.Name, company.Description, company.Website, company.Address, company.CompanySize, company.LogoUrl, company.IsBlocked, company.CreatedAt, company.TaxCode);
    }
}

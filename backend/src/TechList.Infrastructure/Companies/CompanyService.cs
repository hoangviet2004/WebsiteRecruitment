using Microsoft.EntityFrameworkCore;
using TechList.Application.Companies.Interfaces;
using TechList.Application.Companies.Models;
using TechList.Application.Profiles.Interfaces;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Companies;

public sealed class CompanyService : ICompanyService
{
    private readonly AppDbContext _db;
    private readonly IAvatarStorageService _imageStorage;

    public CompanyService(AppDbContext db, IAvatarStorageService imageStorage)
    {
        _db = db;
        _imageStorage = imageStorage;
    }

    public async Task<List<CompanyDto>> GetAllCompaniesAsync(CancellationToken ct)
    {
        var userFeaturedMap = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.Status == TechList.Domain.Enums.SubscriptionStatus.Active && s.Package.AllowFeaturedCompany == true)
            .OrderByDescending(s => s.Package.Price)
            .GroupBy(s => s.UserId)
            .Select(g => new { UserId = g.Key, Level = g.First().Package.FeaturedLevel })
            .ToDictionaryAsync(x => x.UserId, x => x.Level, ct);

        var companies = await _db.Companies
            .AsNoTracking()
            .Where(c => !c.IsBlocked)
            .ToListAsync(ct);

        return companies.Select(c => {
            var level = userFeaturedMap.GetValueOrDefault(c.OwnerId);
            return new CompanyDto(
                c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, c.LogoUrl, c.CoverImageUrl, c.IsBlocked, c.CreatedAt, c.TaxCode, c.ContactEmail, c.ContactPhone,
                level != null && level != "None",
                level);
        }).ToList();
    }

    public async Task<CompanyDto> GetCompanyByIdAsync(Guid id, CancellationToken ct)
    {
        var c = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);
 
        if (c is null)
            throw new InvalidOperationException("Company not found");

        var sub = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.UserId == c.OwnerId && 
                          s.Status == TechList.Domain.Enums.SubscriptionStatus.Active && 
                          s.Package.AllowFeaturedCompany == true)
            .OrderByDescending(s => s.Package.Price)
            .FirstOrDefaultAsync(ct);
 
        var level = sub?.Package.FeaturedLevel;
        return new CompanyDto(c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, c.LogoUrl, c.CoverImageUrl, c.IsBlocked, c.CreatedAt, c.TaxCode, c.ContactEmail, c.ContactPhone, level != null && level != "None", level);
    }

    public async Task<CompanyDto> GetMyCompanyAsync(string userId, CancellationToken ct)
    {
        var c = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.OwnerId == userId, ct);
 
        if (c is null)
            throw new InvalidOperationException("You do not have a company profile yet.");

        var isFeatured = await _db.Subscriptions
            .Include(s => s.Package)
            .AnyAsync(s => s.UserId == userId && 
                          s.Status == TechList.Domain.Enums.SubscriptionStatus.Active && 
                          s.Package.AllowFeaturedCompany == true, ct);
 
        return new CompanyDto(c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, c.LogoUrl, c.CoverImageUrl, c.IsBlocked, c.CreatedAt, c.TaxCode, c.ContactEmail, c.ContactPhone, isFeatured);
    }

    public async Task<CompanyDto> CreateCompanyAsync(string userId, CreateCompanyRequest request, CancellationToken ct)
    {
        var existing = await _db.Companies.AnyAsync(x => x.OwnerId == userId, ct);
        if (existing)
            throw new InvalidOperationException("You already have a company. Please update your existing company instead of creating a new one.");

        if (!string.IsNullOrWhiteSpace(request.TaxCode))
        {
            var taxDuplicate = await _db.Companies.AnyAsync(x => x.TaxCode == request.TaxCode.Trim(), ct);
            if (taxDuplicate)
                throw new InvalidOperationException("Mã số thuế này đã được đăng ký bởi một công ty khác.");
        }

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
            ContactEmail = request.ContactEmail,
            ContactPhone = request.ContactPhone,
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

        return new CompanyDto(company.Id, company.OwnerId, company.Name, company.Description, company.Website, company.Address, company.CompanySize, company.LogoUrl, company.CoverImageUrl, company.IsBlocked, company.CreatedAt, company.TaxCode, company.ContactEmail, company.ContactPhone, false);
    }

    public async Task<CompanyDto> UpdateCompanyAsync(string userId, Guid companyId, UpdateCompanyRequest request, CancellationToken ct)
    {
        var company = await _db.Companies.AsTracking().FirstOrDefaultAsync(x => x.Id == companyId, ct);
        if (company is null)
            throw new InvalidOperationException("Company not found");

        if (company.OwnerId != userId)
            throw new UnauthorizedAccessException("You can only update your own company.");

        if (!string.IsNullOrWhiteSpace(request.TaxCode))
        {
            var taxDuplicate = await _db.Companies.AnyAsync(x => x.TaxCode == request.TaxCode.Trim() && x.Id != companyId, ct);
            if (taxDuplicate)
                throw new InvalidOperationException("Mã số thuế này đã được đăng ký bởi một công ty khác.");
        }

        company.Name = request.Name;
        company.Description = request.Description ?? string.Empty;
        company.Website = request.Website ?? string.Empty;
        company.Address = request.Address ?? string.Empty;
        company.CompanySize = request.CompanySize;
        company.TaxCode = request.TaxCode;
        company.ContactEmail = request.ContactEmail;
        company.ContactPhone = request.ContactPhone;
        company.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        var isFeatured = await _db.Subscriptions
            .Include(s => s.Package)
            .AnyAsync(s => s.UserId == userId && 
                          s.Status == TechList.Domain.Enums.SubscriptionStatus.Active && 
                          s.Package.AllowFeaturedCompany == true, ct);

        return new CompanyDto(company.Id, company.OwnerId, company.Name, company.Description, company.Website, company.Address, company.CompanySize, company.LogoUrl, company.CoverImageUrl, company.IsBlocked, company.CreatedAt, company.TaxCode, company.ContactEmail, company.ContactPhone, isFeatured);
    }

    public async Task<List<CompanyDto>> GetFeaturedCompaniesAsync(CancellationToken ct)
    {
        // Find users with active featured subs
        var userFeaturedMap = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.Status == TechList.Domain.Enums.SubscriptionStatus.Active && s.Package.AllowFeaturedCompany == true)
            .OrderByDescending(s => s.Package.Price)
            .GroupBy(s => s.UserId)
            .Select(g => new { UserId = g.Key, Level = g.First().Package.FeaturedLevel })
            .ToDictionaryAsync(x => x.UserId, x => x.Level, ct);
            
        var featuredUserIds = userFeaturedMap.Keys.ToList();

        // Fetch their companies
        var dbCompanies = await _db.Companies
            .Where(c => featuredUserIds.Contains(c.OwnerId) && !c.IsBlocked)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        return dbCompanies.Select(c => new CompanyDto(
                c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, 
                c.LogoUrl, c.CoverImageUrl, c.IsBlocked, c.CreatedAt, c.TaxCode, 
                c.ContactEmail, c.ContactPhone, true, userFeaturedMap[c.OwnerId]))
            .ToList();
    }

    public async Task<string> UploadLogoAsync(string userId, Guid companyId, Stream content, string fileName, CancellationToken ct)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(x => x.Id == companyId, ct);
        if (company is null) throw new InvalidOperationException("Company not found");
        if (company.OwnerId != userId) throw new UnauthorizedAccessException("You can only update your own company.");

        if (!string.IsNullOrEmpty(company.LogoPublicId))
        {
            await _imageStorage.DeleteAsync(company.LogoPublicId, ct);
        }

        var result = await _imageStorage.UploadAvatarAsync(content, fileName, ct);
        company.LogoUrl = result.Url;
        company.LogoPublicId = result.PublicId;
        company.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return result.Url;
    }

    public async Task<string> UploadCoverImageAsync(string userId, Guid companyId, Stream content, string fileName, CancellationToken ct)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(x => x.Id == companyId, ct);
        if (company is null) throw new InvalidOperationException("Company not found");
        if (company.OwnerId != userId) throw new UnauthorizedAccessException("You can only update your own company.");

        if (!string.IsNullOrEmpty(company.CoverImagePublicId))
        {
            await _imageStorage.DeleteAsync(company.CoverImagePublicId, ct);
        }

        var result = await _imageStorage.UploadAvatarAsync(content, fileName, ct);
        company.CoverImageUrl = result.Url;
        company.CoverImagePublicId = result.PublicId;
        company.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return result.Url;
    }
}

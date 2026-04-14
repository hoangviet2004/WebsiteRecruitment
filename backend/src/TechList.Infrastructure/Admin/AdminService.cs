using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TechList.Application.Admin.Interfaces;
using TechList.Application.Admin.Models;
using TechList.Application.Jobs.Models;
using TechList.Application.Companies.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;
using TechList.Infrastructure.Identity;

namespace TechList.Infrastructure.Admin;

public sealed class AdminService : IAdminService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public AdminService(AppDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<List<UserDto>> GetAllUsersAsync(CancellationToken ct)
    {
        var users = await _userManager.Users.AsNoTracking().ToListAsync(ct);
        var profiles = await _db.UserProfiles.AsNoTracking().ToListAsync(ct);
        var userDtos = new List<UserDto>();
        
        foreach (var user in users)
        {
            var role = (await _userManager.GetRolesAsync(user)).FirstOrDefault() ?? "Unknown";
            var profile = profiles.FirstOrDefault(p => p.UserId == user.Id);
            userDtos.Add(new UserDto(user.Id, user.Email!, user.FullName, role, profile?.IsApproved ?? false, user.CreatedAt));
        }

        return userDtos.OrderByDescending(x => x.CreatedAt).ToList();
    }

    public async Task DeleteUserAsync(string userId, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) throw new InvalidOperationException("User not found");
        
        // ASP.NET Core Identity cascade delete might depend on DB layout. 
        // We manually delete dependent Companies (and cascaded jobs) if needed, 
        // but Entity Framework might handle cascade deleting if properly configured.
        // Let's delete the companies explicitly to be safe:
        var companies = await _db.Companies.Where(x => x.OwnerId == userId).ToListAsync(ct);
        if (companies.Any())
        {
            _db.Companies.RemoveRange(companies);
        }

        await _userManager.DeleteAsync(user);
        await _db.SaveChangesAsync(ct);
    }

    public async Task ApproveUserAsync(string userId, CancellationToken ct)
    {
        var profile = await _db.UserProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (profile == null) throw new InvalidOperationException("Profile not found");

        profile.IsApproved = true;
        profile.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task ChangeUserRoleAsync(string userId, string newRole, CancellationToken ct)
    {
        if (newRole != TechList.Domain.Enums.AppRole.Admin &&
            newRole != TechList.Domain.Enums.AppRole.Recruiter &&
            newRole != TechList.Domain.Enums.AppRole.Candidate)
        {
            throw new InvalidOperationException("Invalid role specified");
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) throw new InvalidOperationException("User not found");

        var currentRoles = await _userManager.GetRolesAsync(user);
        await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, newRole);
    }

    public async Task<List<JobDto>> GetAllJobsAsync(CancellationToken ct)
    {
        var jobs = await _db.JobPosts
            .Include(x => x.Company)
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return jobs.Select(j => new JobDto(
            j.Id,
            j.CompanyId,
            j.Company?.Name ?? "Unknown",
            j.Company?.LogoUrl,
            j.Title,
            j.Description,
            j.Requirements,
            j.Benefits,
            j.MinSalary,
            j.MaxSalary,
            j.Location,
            j.JobType,
            j.ExpiresAt,
            j.IsActive,
            j.IsApproved,
            j.CreatedAt
        )).ToList();
    }

    public async Task ToggleJobStatusAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.JobPosts.FirstOrDefaultAsync(x => x.Id == jobId, ct);
        if (job == null) throw new InvalidOperationException("Job not found");

        job.IsActive = !job.IsActive;
        await _db.SaveChangesAsync(ct);
    }

    public async Task ApproveJobAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.JobPosts.FirstOrDefaultAsync(x => x.Id == jobId, ct);
        if (job == null) throw new InvalidOperationException("Job not found");

        job.IsApproved = true;
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<CompanyDto>> GetAllCompaniesAsync(CancellationToken ct)
    {
        var companies = await _db.Companies
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return companies.Select(c => new CompanyDto(
            c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.LogoUrl)).ToList();
    }

    public async Task DeleteCompanyAsync(Guid companyId, CancellationToken ct)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(x => x.Id == companyId, ct);
        if (company == null) throw new InvalidOperationException("Company not found");

        _db.Companies.Remove(company);
        await _db.SaveChangesAsync(ct);
    }
}

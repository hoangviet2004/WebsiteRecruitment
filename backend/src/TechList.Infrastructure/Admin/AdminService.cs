using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TechList.Application.Admin.Interfaces;
using TechList.Application.Admin.Models;
using TechList.Application.Jobs.Models;
using TechList.Application.Companies.Models;
using TechList.Application.Notifications.Interfaces;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;
using TechList.Infrastructure.Identity;

namespace TechList.Infrastructure.Admin;

public sealed class AdminService : IAdminService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly INotificationService _notificationService;

    public AdminService(AppDbContext db, UserManager<ApplicationUser> userManager, INotificationService notificationService)
    {
        _db = db;
        _userManager = userManager;
        _notificationService = notificationService;
    }

    public async Task<List<UserDto>> GetAllUsersAsync(CancellationToken ct)
    {
        var users = await _userManager.Users.AsNoTracking().ToListAsync(ct);
        var profiles = await _db.UserProfiles.AsNoTracking().ToListAsync(ct);
        var userLogins = await _db.UserLogins.AsNoTracking().ToListAsync(ct);
        var userDtos = new List<UserDto>();
        
        foreach (var user in users)
        {
            var role = (await _userManager.GetRolesAsync(user)).FirstOrDefault() ?? "Unknown";
            var profile = profiles.FirstOrDefault(p => p.UserId == user.Id);
            var login = userLogins.FirstOrDefault(l => l.UserId == user.Id);
            var provider = login?.LoginProvider ?? "Local";
            var isApproved = role == TechList.Domain.Enums.AppRole.Admin ? true : (profile?.IsApproved ?? false);
            userDtos.Add(new UserDto(user.Id, user.Email!, user.FullName, role, isApproved, provider, user.CreatedAt));
        }

        return userDtos.OrderByDescending(x => x.CreatedAt).ToList();
    }

    public async Task<CandidateProfileDto> GetCandidateProfileAsync(string userId, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) throw new InvalidOperationException("User not found");

        var roles = await _userManager.GetRolesAsync(user);
        if (!roles.Contains(TechList.Domain.Enums.AppRole.Candidate))
            throw new InvalidOperationException("User is not a candidate");

        var profile = await _db.UserProfiles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == userId, ct);

        var login = await _db.UserLogins.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, ct);

        return new CandidateProfileDto(
            UserId: user.Id,
            Email: user.Email!,
            FullName: user.FullName,
            DisplayName: profile?.DisplayName ?? user.FullName,
            Bio: profile?.Bio ?? string.Empty,
            AvatarUrl: profile?.AvatarUrl,
            IsApproved: profile?.IsApproved ?? false,
            Provider: login?.LoginProvider ?? "Local",
            CreatedAt: user.CreatedAt
        );
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

    public async Task ToggleBlockUserAsync(string userId, CancellationToken ct)
    {
        var profile = await _db.UserProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (profile == null)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) throw new InvalidOperationException("User not found");

            profile = new UserProfile
            {
                UserId = userId,
                DisplayName = string.IsNullOrWhiteSpace(user.FullName) ? user.Email!.Split('@')[0] : user.FullName,
                Bio = string.Empty,
                IsApproved = true, // Toggling from false (implicitly blocked due to null profile) to true
                UpdatedAt = DateTime.UtcNow
            };
            _db.UserProfiles.Add(profile);
        }
        else
        {
            profile.IsApproved = !profile.IsApproved;
            profile.UpdatedAt = DateTime.UtcNow;
        }

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
            j.Experience,
            j.Education,
            j.ExpiresAt,
            j.IsActive,
            j.IsApproved,
            j.CreatedAt,
            j.IsFeatured,
            j.FeaturedLevel,
            j.IsBlocked,
            j.BlockReason
        )).ToList();
    }

    public async Task ToggleJobStatusAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.JobPosts.Include(x => x.Company).FirstOrDefaultAsync(x => x.Id == jobId, ct);
        if (job == null) throw new InvalidOperationException("Job not found");

        job.IsActive = !job.IsActive;
        await _db.SaveChangesAsync(ct);

        var recruiterId = job.Company.OwnerId;
        if (job.IsActive)
            await _notificationService.CreateAsync(recruiterId,
                "Tin tuyển dụng đã được hiển thị lại",
                $"Tin \"{job.Title}\" đã được admin bật hiển thị trở lại.",
                "Shown", job.Id, job.Title, ct);
        else
            await _notificationService.CreateAsync(recruiterId,
                "Tin tuyển dụng đã bị ẩn",
                $"Tin \"{job.Title}\" đã bị admin tạm ẩn khỏi hệ thống.",
                "Hidden", job.Id, job.Title, ct);
    }

    public async Task ApproveJobAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.JobPosts.Include(x => x.Company).FirstOrDefaultAsync(x => x.Id == jobId, ct);
        if (job == null) throw new InvalidOperationException("Job not found");

        job.IsApproved = true;
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _notificationService.CreateAsync(job.Company.OwnerId,
            "Tin tuyển dụng đã được duyệt",
            $"Tin \"{job.Title}\" đã được admin phê duyệt và hiển thị trên hệ thống.",
            "Approved", job.Id, job.Title, ct);
    }

    public async Task ToggleBlockJobAsync(Guid jobId, string? reason, CancellationToken ct)
    {
        var job = await _db.JobPosts.Include(x => x.Company).FirstOrDefaultAsync(x => x.Id == jobId, ct);
        if (job == null) throw new InvalidOperationException("Job not found");

        job.IsBlocked = !job.IsBlocked;
        job.BlockReason = job.IsBlocked ? reason : null;
        job.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var recruiterId = job.Company.OwnerId;
        if (job.IsBlocked)
            await _notificationService.CreateAsync(recruiterId,
                "Tin tuyển dụng bị từ chối",
                $"Tin \"{job.Title}\" đã bị từ chối. Lý do: {reason ?? "Không có lý do cụ thể"}.",
                "Rejected", job.Id, job.Title, ct);
        else
            await _notificationService.CreateAsync(recruiterId,
                "Tin tuyển dụng đã được khôi phục",
                $"Tin \"{job.Title}\" đã được admin khôi phục và có thể hoạt động bình thường.",
                "Unblocked", job.Id, job.Title, ct);
    }

    public async Task<List<CompanyDto>> GetAllCompaniesAsync(CancellationToken ct)
    {
        var companies = await _db.Companies
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return companies.Select(c => new CompanyDto(
            c.Id, c.OwnerId, c.Name, c.Description, c.Website, c.Address, c.CompanySize, c.LogoUrl, c.CoverImageUrl, c.IsBlocked, c.CreatedAt, c.TaxCode, c.ContactEmail, c.ContactPhone)).ToList();
    }

    public async Task ToggleCompanyStatusAsync(Guid companyId, CancellationToken ct)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(x => x.Id == companyId, ct);
        if (company == null) throw new InvalidOperationException("Company not found");

        company.IsBlocked = !company.IsBlocked;
        company.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (company.IsBlocked)
            await _notificationService.CreateAsync(company.OwnerId,
                "Công ty đã bị chặn",
                $"Công ty \"{company.Name}\" đã bị quản trị viên chặn. Các tin tuyển dụng sẽ bị ẩn và bạn không thể đăng hoặc sửa tin mới.",
                "CompanyBlocked", null, company.Name, ct);
        else
            await _notificationService.CreateAsync(company.OwnerId,
                "Công ty đã được bỏ chặn",
                $"Công ty \"{company.Name}\" đã được quản trị viên bỏ chặn. Bạn có thể hoạt động bình thường trở lại.",
                "CompanyUnblocked", null, company.Name, ct);
    }

    public async Task DeleteCompanyAsync(Guid companyId, CancellationToken ct)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(x => x.Id == companyId, ct);
        if (company == null) throw new InvalidOperationException("Company not found");

        _db.Companies.Remove(company);
        await _db.SaveChangesAsync(ct);
    }
}

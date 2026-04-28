using Microsoft.EntityFrameworkCore;
using TechList.Application.Jobs.Interfaces;
using TechList.Application.Jobs.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Jobs;

public sealed class JobService : IJobService
{
    private readonly AppDbContext _db;

    public JobService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<JobDto>> GetActiveJobsAsync(CancellationToken ct)
    {
        var jobs = await _db.JobPosts
            .Include(x => x.Company)
            .AsNoTracking()
            .Where(x => x.IsActive && x.IsApproved && x.ExpiresAt >= DateTime.UtcNow)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return jobs.Select(MapToDto).ToList();
    }

    public async Task<List<JobDto>> GetJobsByCompanyAsync(Guid companyId, CancellationToken ct)
    {
        var jobs = await _db.JobPosts
            .Include(x => x.Company)
            .AsNoTracking()
            .Where(x => x.CompanyId == companyId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return jobs.Select(MapToDto).ToList();
    }

    public async Task<JobDto> GetJobByIdAsync(Guid id, CancellationToken ct)
    {
        var job = await _db.JobPosts
            .Include(x => x.Company)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (job is null)
            throw new InvalidOperationException("Job not found");

        return MapToDto(job);
    }

    public async Task<JobDto> CreateJobAsync(string userId, CreateJobRequest request, CancellationToken ct)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(x => x.Id == request.CompanyId, ct);
        if (company is null)
            throw new InvalidOperationException("Company not found");

        if (company.OwnerId != userId)
            throw new UnauthorizedAccessException("You do not have permission to post a job for this company.");

        // ── Subscription check ───────────────────────────────
        var subscription = await _db.Subscriptions
            .Include(s => s.Package)
            .Where(s => s.UserId == userId && s.Status == TechList.Domain.Enums.SubscriptionStatus.Active)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);

        // Auto-create Free subscription if none exists
        if (subscription == null)
        {
            var freePackage = await _db.ServicePackages
                .FirstOrDefaultAsync(p => p.Price == 0 && p.IsActive, ct);
            if (freePackage == null)
                throw new InvalidOperationException("Không tìm thấy gói dịch vụ mặc định. Vui lòng liên hệ quản trị viên.");

            subscription = new Subscription
            {
                UserId = userId,
                PackageId = freePackage.Id,
                StartDate = DateTime.UtcNow,
                EndDate = DateTime.UtcNow.AddDays(freePackage.DurationDays),
                Status = TechList.Domain.Enums.SubscriptionStatus.Active,
                JobPostsUsed = 0
            };
            subscription.Package = freePackage;
            _db.Subscriptions.Add(subscription);
            await _db.SaveChangesAsync(ct);
        }

        // Check if subscription has expired
        if (subscription.EndDate < DateTime.UtcNow)
        {
            subscription.Status = TechList.Domain.Enums.SubscriptionStatus.Expired;
            await _db.SaveChangesAsync(ct);
            throw new InvalidOperationException($"Gói dịch vụ \"{subscription.Package.Name}\" của bạn đã hết hạn. Vui lòng gia hạn hoặc nâng cấp gói.");
        }

        // Check job post limit (-1 = unlimited)
        if (subscription.Package.MaxJobPosts != -1 && subscription.JobPostsUsed >= subscription.Package.MaxJobPosts)
        {
            throw new InvalidOperationException(
                $"Bạn đã đạt giới hạn {subscription.Package.MaxJobPosts} tin đăng của gói \"{subscription.Package.Name}\". " +
                $"Vui lòng nâng cấp gói dịch vụ để đăng thêm tin.");
        }

        var job = new JobPost
        {
            Id = Guid.NewGuid(),
            CompanyId = request.CompanyId,
            Title = request.Title,
            Description = request.Description,
            Requirements = request.Requirements,
            Benefits = request.Benefits,
            MinSalary = request.MinSalary,
            MaxSalary = request.MaxSalary,
            Location = request.Location,
            JobType = request.JobType,
            Experience = request.Experience,
            Education = request.Education,
            ExpiresAt = request.ExpiresAt,
            IsActive = request.IsActive,
            IsApproved = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.JobPosts.Add(job);

        // Increment job posts used
        subscription.JobPostsUsed++;
        subscription.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Fetch again to include Company projection
        return await GetJobByIdAsync(job.Id, ct);
    }

    public async Task<JobDto> UpdateJobAsync(string userId, Guid jobId, UpdateJobRequest request, CancellationToken ct)
    {
        var job = await _db.JobPosts.Include(x => x.Company).AsTracking().FirstOrDefaultAsync(x => x.Id == jobId, ct);
        if (job is null)
            throw new InvalidOperationException("Job not found");

        if (job.Company.OwnerId != userId)
            throw new UnauthorizedAccessException("You do not have permission to update this job.");

        job.Title = request.Title;
        job.Description = request.Description;
        job.Requirements = request.Requirements;
        job.Benefits = request.Benefits;
        job.MinSalary = request.MinSalary;
        job.MaxSalary = request.MaxSalary;
        job.Location = request.Location;
        job.JobType = request.JobType;
        job.Experience = request.Experience;
        job.Education = request.Education;
        job.ExpiresAt = request.ExpiresAt;
        job.IsActive = request.IsActive;
        job.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return MapToDto(job);
    }

    public async Task DeleteJobAsync(string userId, Guid jobId, CancellationToken ct)
    {
        var job = await _db.JobPosts.Include(x => x.Company).AsTracking().FirstOrDefaultAsync(x => x.Id == jobId, ct);
        if (job is null)
            throw new InvalidOperationException("Job not found");

        // Allow deletion if the user is the owner of the job's company
        if (job.Company.OwnerId != userId)
        {
            // Note: Admin deletion can be handled separately or added here contextually.
            // For now, strict Owner check.
            throw new UnauthorizedAccessException("You do not have permission to delete this job.");
        }

        _db.JobPosts.Remove(job);

        // Decrement job posts used counter
        var subscription = await _db.Subscriptions
            .Where(s => s.UserId == userId && s.Status == TechList.Domain.Enums.SubscriptionStatus.Active)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (subscription != null && subscription.JobPostsUsed > 0)
        {
            subscription.JobPostsUsed--;
            subscription.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
    }

    private static JobDto MapToDto(JobPost x) => new JobDto(
        x.Id,
        x.CompanyId,
        x.Company.Name,
        x.Company.LogoUrl,
        x.Title,
        x.Description,
        x.Requirements,
        x.Benefits,
        x.MinSalary,
        x.MaxSalary,
        x.Location,
        x.JobType,
        x.Experience,
        x.Education,
        x.ExpiresAt,
        x.IsActive,
        x.IsApproved,
        x.CreatedAt
    );
}

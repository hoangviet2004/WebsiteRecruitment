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
            .Where(x => x.IsActive && x.ExpiresAt >= DateTime.UtcNow)
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
            ExpiresAt = request.ExpiresAt,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.JobPosts.Add(job);
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
        x.ExpiresAt,
        x.IsActive,
        x.CreatedAt
    );
}

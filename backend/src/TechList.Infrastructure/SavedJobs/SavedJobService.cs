using Microsoft.EntityFrameworkCore;
using TechList.Application.SavedJobs.Interfaces;
using TechList.Application.SavedJobs.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.SavedJobs;

public sealed class SavedJobService : ISavedJobService
{
    private readonly AppDbContext _db;

    public SavedJobService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Lấy toàn bộ saved jobs – 1 query duy nhất với Include, không N+1.
    /// </summary>
    public async Task<List<SavedJobDto>> GetSavedJobsAsync(string userId, CancellationToken ct)
    {
        var saved = await _db.SavedJobs
            .Include(x => x.JobPost)
                .ThenInclude(j => j.Company)
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.SavedAt)
            .ToListAsync(ct);

        return saved.Select(MapToDto).ToList();
    }

    /// <summary>Lưu job vào danh sách yêu thích. Ném lỗi nếu đã lưu rồi.</summary>
    public async Task<SavedJobDto> SaveJobAsync(string userId, SaveJobRequest request, CancellationToken ct)
    {
        // Kiểm tra job tồn tại
        var jobExists = await _db.JobPosts.AnyAsync(x => x.Id == request.JobPostId, ct);
        if (!jobExists)
            throw new InvalidOperationException("Tin tuyển dụng không tồn tại.");

        // Kiểm tra đã lưu chưa
        var alreadySaved = await _db.SavedJobs
            .AnyAsync(x => x.UserId == userId && x.JobPostId == request.JobPostId, ct);
        if (alreadySaved)
            throw new InvalidOperationException("Bạn đã lưu tin tuyển dụng này rồi.");

        var validCollections = new[] { "Tất cả", "Muốn apply", "Đang cân nhắc" };
        var collection = validCollections.Contains(request.Collection)
            ? request.Collection
            : "Tất cả";

        var entity = new SavedJob
        {
            Id        = Guid.NewGuid(),
            UserId    = userId,
            JobPostId = request.JobPostId,
            Collection = collection,
            SavedAt   = DateTime.UtcNow
        };

        _db.SavedJobs.Add(entity);
        await _db.SaveChangesAsync(ct);

        // Reload với navigation properties
        var saved = await _db.SavedJobs
            .Include(x => x.JobPost)
                .ThenInclude(j => j.Company)
            .AsNoTracking()
            .FirstAsync(x => x.Id == entity.Id, ct);

        return MapToDto(saved);
    }

    /// <summary>Cập nhật collection của saved job.</summary>
    public async Task UpdateCollectionAsync(string userId, Guid savedJobId, UpdateCollectionRequest request, CancellationToken ct)
    {
        var saved = await _db.SavedJobs
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == savedJobId && x.UserId == userId, ct);

        if (saved is null)
            throw new InvalidOperationException("Không tìm thấy việc làm đã lưu.");

        var validCollections = new[] { "Tất cả", "Muốn apply", "Đang cân nhắc" };
        if (!validCollections.Contains(request.Collection))
            throw new ArgumentException("Collection không hợp lệ.");

        saved.Collection = request.Collection;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Bỏ lưu (xóa) một saved job.</summary>
    public async Task RemoveSavedJobAsync(string userId, Guid savedJobId, CancellationToken ct)
    {
        var saved = await _db.SavedJobs
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == savedJobId && x.UserId == userId, ct);

        if (saved is null)
            throw new InvalidOperationException("Không tìm thấy việc làm đã lưu.");

        _db.SavedJobs.Remove(saved);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Kiểm tra job có trong danh sách yêu thích không.</summary>
    public async Task<bool> IsJobSavedAsync(string userId, Guid jobPostId, CancellationToken ct)
    {
        return await _db.SavedJobs
            .AsNoTracking()
            .AnyAsync(x => x.UserId == userId && x.JobPostId == jobPostId, ct);
    }

    /// <summary>Trả về SavedJob.Id nếu đã lưu, null nếu chưa — 1 query.</summary>
    public async Task<Guid?> GetSavedJobIdAsync(string userId, Guid jobPostId, CancellationToken ct)
    {
        var id = await _db.SavedJobs
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.JobPostId == jobPostId)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(ct);
        return id;
    }

    // ── Mapper ───────────────────────────────────────────────
    private static SavedJobDto MapToDto(SavedJob x) => new(
        x.Id,
        x.JobPostId,
        x.JobPost.Title,
        x.JobPost.Company.Name,
        x.JobPost.Company.LogoUrl,
        x.JobPost.MinSalary,
        x.JobPost.MaxSalary,
        x.JobPost.Location,
        x.JobPost.JobType,
        x.JobPost.Experience,
        x.JobPost.Requirements,
        x.JobPost.Benefits,
        x.JobPost.ExpiresAt,
        x.Collection,
        x.SavedAt
    );
}

using TechList.Application.SavedJobs.Models;

namespace TechList.Application.SavedJobs.Interfaces;

public interface ISavedJobService
{
    /// <summary>Lấy toàn bộ saved jobs của user – 1 query duy nhất (no N+1)</summary>
    Task<List<SavedJobDto>> GetSavedJobsAsync(string userId, CancellationToken ct);

    /// <summary>Lưu job vào danh sách yêu thích</summary>
    Task<SavedJobDto> SaveJobAsync(string userId, SaveJobRequest request, CancellationToken ct);

    /// <summary>Cập nhật collection của một saved job</summary>
    Task UpdateCollectionAsync(string userId, Guid savedJobId, UpdateCollectionRequest request, CancellationToken ct);

    /// <summary>Bỏ lưu (xóa) một saved job</summary>
    Task RemoveSavedJobAsync(string userId, Guid savedJobId, CancellationToken ct);

    /// <summary>Kiểm tra job đã được lưu chưa</summary>
    Task<bool> IsJobSavedAsync(string userId, Guid jobPostId, CancellationToken ct);

    /// <summary>Trả về SavedJob.Id nếu đã lưu, null nếu chưa</summary>
    Task<Guid?> GetSavedJobIdAsync(string userId, Guid jobPostId, CancellationToken ct);
}

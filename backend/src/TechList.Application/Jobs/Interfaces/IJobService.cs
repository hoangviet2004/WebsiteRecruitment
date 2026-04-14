using TechList.Application.Jobs.Models;

namespace TechList.Application.Jobs.Interfaces;

public interface IJobService
{
    Task<List<JobDto>> GetActiveJobsAsync(CancellationToken ct);
    Task<List<JobDto>> GetJobsByCompanyAsync(Guid companyId, CancellationToken ct);
    Task<JobDto> GetJobByIdAsync(Guid id, CancellationToken ct);
    Task<JobDto> CreateJobAsync(string userId, CreateJobRequest request, CancellationToken ct);
    Task<JobDto> UpdateJobAsync(string userId, Guid jobId, UpdateJobRequest request, CancellationToken ct);
    Task DeleteJobAsync(string userId, Guid jobId, CancellationToken ct);
}

using TechList.Application.Applications.Models;

namespace TechList.Application.Applications.Interfaces;

public interface IJobApplicationService
{
    // Candidate: nộp đơn
    Task<JobApplicationDto> ApplyAsync(string candidateId, CreateApplicationRequest request, CancellationToken ct);

    // Candidate: xem danh sách đơn đã nộp
    Task<List<JobApplicationDto>> GetMyApplicationsAsync(string candidateId, CancellationToken ct);

    // Recruiter: xem đơn ứng tuyển của 1 job
    Task<List<JobApplicationDto>> GetByJobAsync(string recruiterId, Guid jobPostId, CancellationToken ct);

    // Recruiter: xem tất cả đơn của company
    Task<List<JobApplicationDto>> GetByCompanyAsync(string recruiterId, Guid companyId, CancellationToken ct);

    // Recruiter: cập nhật trạng thái đơn
    Task<JobApplicationDto> UpdateStatusAsync(string recruiterId, Guid applicationId, string newStatus, CancellationToken ct);

    // Recruiter/Candidate: xem chi tiết đơn
    Task<JobApplicationDto> GetByIdAsync(string userId, Guid applicationId, CancellationToken ct);
}

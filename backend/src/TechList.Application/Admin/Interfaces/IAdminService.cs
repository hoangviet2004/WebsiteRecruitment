using TechList.Application.Admin.Models;
using TechList.Application.Companies.Models;
using TechList.Application.Jobs.Models;

namespace TechList.Application.Admin.Interfaces;

public interface IAdminService
{
    Task<List<UserDto>> GetAllUsersAsync(CancellationToken ct);
    Task<CandidateProfileDto> GetCandidateProfileAsync(string userId, CancellationToken ct);
    Task DeleteUserAsync(string userId, CancellationToken ct);
    Task ToggleBlockUserAsync(string userId, CancellationToken ct);
    Task ChangeUserRoleAsync(string userId, string newRole, CancellationToken ct);

    Task<List<JobDto>> GetAllJobsAsync(CancellationToken ct);
    Task ToggleJobStatusAsync(Guid jobId, CancellationToken ct);
    Task ApproveJobAsync(Guid jobId, CancellationToken ct);

    Task<List<CompanyDto>> GetAllCompaniesAsync(CancellationToken ct);
    Task ToggleCompanyStatusAsync(Guid companyId, CancellationToken ct);
    Task DeleteCompanyAsync(Guid companyId, CancellationToken ct);
}

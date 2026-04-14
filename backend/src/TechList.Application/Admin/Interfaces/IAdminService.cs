using TechList.Application.Admin.Models;
using TechList.Application.Companies.Models;
using TechList.Application.Jobs.Models;

namespace TechList.Application.Admin.Interfaces;

public interface IAdminService
{
    Task<List<UserDto>> GetAllUsersAsync(CancellationToken ct);
    Task DeleteUserAsync(string userId, CancellationToken ct);

    Task<List<JobDto>> GetAllJobsAsync(CancellationToken ct);
    Task ToggleJobStatusAsync(Guid jobId, CancellationToken ct);

    Task<List<CompanyDto>> GetAllCompaniesAsync(CancellationToken ct);
    Task DeleteCompanyAsync(Guid companyId, CancellationToken ct);
}

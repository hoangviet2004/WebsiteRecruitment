using TechList.Application.Companies.Models;

namespace TechList.Application.Companies.Interfaces;

public interface ICompanyService
{
    Task<List<CompanyDto>> GetAllCompaniesAsync(CancellationToken ct);
    Task<CompanyDto> GetCompanyByIdAsync(Guid id, CancellationToken ct);
    Task<CompanyDto> GetMyCompanyAsync(string userId, CancellationToken ct);
    Task<CompanyDto> CreateCompanyAsync(string userId, CreateCompanyRequest request, CancellationToken ct);
    Task<CompanyDto> UpdateCompanyAsync(string userId, Guid companyId, UpdateCompanyRequest request, CancellationToken ct);
    Task<List<CompanyDto>> GetFeaturedCompaniesAsync(CancellationToken ct);
}

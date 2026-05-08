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
    Task<string> UploadLogoAsync(string userId, Guid companyId, Stream content, string fileName, CancellationToken ct);
    Task<string> UploadCoverImageAsync(string userId, Guid companyId, Stream content, string fileName, CancellationToken ct);
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Companies.Interfaces;
using TechList.Application.Companies.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/companies")]
public sealed class CompanyController : ControllerBase
{
    private readonly ICompanyService _companyService;

    public CompanyController(ICompanyService companyService)
    {
        _companyService = companyService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<CompanyDto>>>> GetAll(CancellationToken ct)
    {
        var result = await _companyService.GetAllCompaniesAsync(ct);
        return Ok(ApiResponse<List<CompanyDto>>.Ok(result));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CompanyDto>>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _companyService.GetCompanyByIdAsync(id, ct);
        return Ok(ApiResponse<CompanyDto>.Ok(result));
    }

    [HttpGet("my-company")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<CompanyDto>>> GetMyCompany(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var result = await _companyService.GetMyCompanyAsync(userId!, ct);
        return Ok(ApiResponse<CompanyDto>.Ok(result));
    }

    [HttpPost]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<CompanyDto>>> Create([FromBody] CreateCompanyRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var result = await _companyService.CreateCompanyAsync(userId!, request, ct);
        return Ok(ApiResponse<CompanyDto>.Ok(result, "Company created successfully"));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<CompanyDto>>> Update(Guid id, [FromBody] UpdateCompanyRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var result = await _companyService.UpdateCompanyAsync(userId!, id, request, ct);
        return Ok(ApiResponse<CompanyDto>.Ok(result, "Company updated successfully"));
    }

    [HttpGet("featured")]
    public async Task<ActionResult<ApiResponse<List<CompanyDto>>>> GetFeatured(CancellationToken ct)
    {
        var result = await _companyService.GetFeaturedCompaniesAsync(ct);
        return Ok(ApiResponse<List<CompanyDto>>.Ok(result));
    }

    [HttpPost("{id:guid}/logo")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<string>>> UploadLogo(Guid id, IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<string>.Fail("No file uploaded"));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        using var stream = file.OpenReadStream();
        var url = await _companyService.UploadLogoAsync(userId!, id, stream, file.FileName, ct);
        
        return Ok(ApiResponse<string>.Ok(url, "Logo uploaded successfully"));
    }

    [HttpPost("{id:guid}/cover")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<string>>> UploadCover(Guid id, IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<string>.Fail("No file uploaded"));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        using var stream = file.OpenReadStream();
        var url = await _companyService.UploadCoverImageAsync(userId!, id, stream, file.FileName, ct);
        
        return Ok(ApiResponse<string>.Ok(url, "Cover image uploaded successfully"));
    }
}

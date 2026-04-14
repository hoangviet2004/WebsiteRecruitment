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
}

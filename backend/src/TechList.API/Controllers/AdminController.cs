using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Admin.Interfaces;
using TechList.Application.Admin.Models;
using TechList.Application.Companies.Models;
using TechList.Application.Jobs.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public sealed class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    // --- USERS ---
    [HttpGet("users")]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAllUsers(CancellationToken ct)
    {
        var result = await _adminService.GetAllUsersAsync(ct);
        return Ok(ApiResponse<List<UserDto>>.Ok(result));
    }

    [HttpDelete("users/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteUser(string id, CancellationToken ct)
    {
        await _adminService.DeleteUserAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "User deleted successfully"));
    }

    // --- JOBS ---
    [HttpGet("jobs")]
    public async Task<ActionResult<ApiResponse<List<JobDto>>>> GetAllJobs(CancellationToken ct)
    {
        var result = await _adminService.GetAllJobsAsync(ct);
        return Ok(ApiResponse<List<JobDto>>.Ok(result));
    }

    [HttpPut("jobs/{id}/toggle")]
    public async Task<ActionResult<ApiResponse<object>>> ToggleJob(Guid id, CancellationToken ct)
    {
        await _adminService.ToggleJobStatusAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Job status toggled successfully"));
    }

    // --- COMPANIES ---
    [HttpGet("companies")]
    public async Task<ActionResult<ApiResponse<List<CompanyDto>>>> GetAllCompanies(CancellationToken ct)
    {
        var result = await _adminService.GetAllCompaniesAsync(ct);
        return Ok(ApiResponse<List<CompanyDto>>.Ok(result));
    }

    [HttpDelete("companies/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteCompany(Guid id, CancellationToken ct)
    {
        await _adminService.DeleteCompanyAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Company deleted successfully"));
    }
}

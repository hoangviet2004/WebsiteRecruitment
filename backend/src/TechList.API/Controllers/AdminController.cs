using System.Security.Claims;
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

    [HttpGet("candidates/{id}/profile")]
    public async Task<ActionResult<ApiResponse<TechList.Application.Admin.Models.CandidateProfileDto>>> GetCandidateProfile(string id, CancellationToken ct)
    {
        var result = await _adminService.GetCandidateProfileAsync(id, ct);
        return Ok(ApiResponse<TechList.Application.Admin.Models.CandidateProfileDto>.Ok(result));
    }

    [HttpDelete("users/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteUser(string id, CancellationToken ct)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == currentUserId)
            return BadRequest(ApiResponse<object>.Fail("Không thể xóa tài khoản của chính mình."));

        await _adminService.DeleteUserAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "User deleted successfully"));
    }

    [HttpPut("users/{id}/toggle-block")]
    public async Task<ActionResult<ApiResponse<object>>> ToggleBlockUser(string id, CancellationToken ct)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == currentUserId)
            return BadRequest(ApiResponse<object>.Fail("Không thể chặn tài khoản của chính mình."));

        await _adminService.ToggleBlockUserAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "User block status toggled successfully"));
    }

    [HttpPut("users/{id}/role")]
    public async Task<ActionResult<ApiResponse<object>>> ChangeRole(string id, [FromBody] TechList.Application.Admin.Models.ChangeRoleRequest request, CancellationToken ct)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == currentUserId)
            return BadRequest(ApiResponse<object>.Fail("Không thể thay đổi quyền của chính mình."));

        if (string.IsNullOrWhiteSpace(request.NewRole)) return BadRequest(ApiResponse<object>.Fail("Role cannot be empty"));
        await _adminService.ChangeUserRoleAsync(id, request.NewRole, ct);
        return Ok(ApiResponse<object>.Ok(null!, "User role updated successfully"));
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

    [HttpPut("jobs/{id}/approve")]
    public async Task<ActionResult<ApiResponse<object>>> ApproveJob(Guid id, CancellationToken ct)
    {
        await _adminService.ApproveJobAsync(id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Job approved successfully"));
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

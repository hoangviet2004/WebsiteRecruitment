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
    private readonly IStatisticsService _statisticsService;

    public AdminController(IAdminService adminService, IStatisticsService statisticsService)
    {
        _adminService = adminService;
        _statisticsService = statisticsService;
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

    // ── STATISTICS ──────────────────────────────────────────────────────────
    private static StatisticsQueryDto ParseQuery(string? startDate, string? endDate)
    {
        var end   = string.IsNullOrWhiteSpace(endDate)   ? DateTime.UtcNow : DateTime.Parse(endDate).ToUniversalTime();
        var start = string.IsNullOrWhiteSpace(startDate) ? end.AddDays(-30)  : DateTime.Parse(startDate).ToUniversalTime();
        var days  = (end - start).TotalDays;
        var period = days <= 14 ? "day" : days <= 90 ? "week" : "month";
        return new StatisticsQueryDto(start, end, period);
    }

    [HttpGet("statistics/overview")]
    public async Task<ActionResult<ApiResponse<OverviewStatsDto>>> GetStatisticsOverview(
        [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct)
    {
        var query  = ParseQuery(startDate, endDate);
        var result = await _statisticsService.GetOverviewAsync(query, ct);
        return Ok(ApiResponse<OverviewStatsDto>.Ok(result));
    }

    [HttpGet("statistics/timeseries")]
    public async Task<ActionResult<ApiResponse<List<TimeSeriesPointDto>>>> GetTimeSeries(
        [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct)
    {
        var query  = ParseQuery(startDate, endDate);
        var result = await _statisticsService.GetTimeSeriesAsync(query, ct);
        return Ok(ApiResponse<List<TimeSeriesPointDto>>.Ok(result));
    }

    [HttpGet("statistics/top-skills")]
    public async Task<ActionResult<ApiResponse<List<SkillStatDto>>>> GetTopSkills(CancellationToken ct)
    {
        var result = await _statisticsService.GetTopSkillsAsync(ct);
        return Ok(ApiResponse<List<SkillStatDto>>.Ok(result));
    }

    [HttpGet("statistics/job-types")]
    public async Task<ActionResult<ApiResponse<List<JobTypeStatDto>>>> GetJobTypes(
        [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct)
    {
        var query  = ParseQuery(startDate, endDate);
        var result = await _statisticsService.GetJobTypeDistributionAsync(query, ct);
        return Ok(ApiResponse<List<JobTypeStatDto>>.Ok(result));
    }

    [HttpGet("statistics/top-companies")]
    public async Task<ActionResult<ApiResponse<List<TopCompanyDto>>>> GetTopCompanies(
        [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct)
    {
        var query  = ParseQuery(startDate, endDate);
        var result = await _statisticsService.GetTopCompaniesAsync(query, ct);
        return Ok(ApiResponse<List<TopCompanyDto>>.Ok(result));
    }

    [HttpGet("statistics/top-jobs")]
    public async Task<ActionResult<ApiResponse<List<TopJobDto>>>> GetTopJobs(
        [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct)
    {
        var query  = ParseQuery(startDate, endDate);
        var result = await _statisticsService.GetTopJobsAsync(query, ct);
        return Ok(ApiResponse<List<TopJobDto>>.Ok(result));
    }

    [HttpGet("statistics/active-recruiters")]
    public async Task<ActionResult<ApiResponse<List<ActiveRecruiterDto>>>> GetActiveRecruiters(
        [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct)
    {
        var query  = ParseQuery(startDate, endDate);
        var result = await _statisticsService.GetActiveRecruitersAsync(query, ct);
        return Ok(ApiResponse<List<ActiveRecruiterDto>>.Ok(result));
    }

    [HttpGet("statistics/candidate-stats")]
    public async Task<ActionResult<ApiResponse<List<CandidateSkillStatDto>>>> GetCandidateStats(CancellationToken ct)
    {
        var result = await _statisticsService.GetCandidateStatsAsync(ct);
        return Ok(ApiResponse<List<CandidateSkillStatDto>>.Ok(result));
    }
}

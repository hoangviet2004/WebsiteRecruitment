using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Recruiters.Interfaces;
using TechList.Application.Recruiters.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/recruiter-stats")]
[Authorize(Roles = "Recruiter")]
public sealed class RecruiterStatisticsController : ControllerBase
{
    private readonly IRecruiterStatisticsService _svc;

    public RecruiterStatisticsController(IRecruiterStatisticsService svc) => _svc = svc;

    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    // Xây dựng query từ period param: "7d" | "30d" | "3m" | "custom"
    private static (DateTime Start, DateTime End) ParsePeriod(string? period, string? from, string? to)
    {
        var end = DateTime.UtcNow.Date.AddDays(1).AddSeconds(-1); // cuối hôm nay
        DateTime start;

        switch ((period ?? "30d").ToLower())
        {
            case "7d":    start = end.AddDays(-7);   break;
            case "3m":    start = end.AddDays(-90);  break;
            case "custom" when DateTime.TryParse(from, out var f) && DateTime.TryParse(to, out var t):
                start = f.ToUniversalTime();
                end   = t.ToUniversalTime().Date.AddDays(1).AddSeconds(-1);
                break;
            default:      start = end.AddDays(-30);  break;
        }

        return (start, end);
    }

    // ── GET /api/recruiter-stats/overview?companyId=...&period=30d ─────────
    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<RecruiterOverviewDto>>> GetOverview(
        [FromQuery] Guid companyId,
        [FromQuery] string? period,
        [FromQuery] string? from,
        [FromQuery] string? to,
        CancellationToken ct)
    {
        var (start, end) = ParsePeriod(period, from, to);
        var query = new RecruiterStatsQuery(companyId, start, end);
        var result = await _svc.GetOverviewAsync(query, ct);
        return Ok(ApiResponse<RecruiterOverviewDto>.Ok(result));
    }

    // ── GET /api/recruiter-stats/status-distribution?companyId=... ────────
    [HttpGet("status-distribution")]
    public async Task<ActionResult<ApiResponse<List<AppStatusDistDto>>>> GetStatusDist(
        [FromQuery] Guid companyId, CancellationToken ct)
    {
        var result = await _svc.GetStatusDistributionAsync(companyId, ct);
        return Ok(ApiResponse<List<AppStatusDistDto>>.Ok(result));
    }

    // ── GET /api/recruiter-stats/trend?companyId=...&period=30d ───────────
    [HttpGet("trend")]
    public async Task<ActionResult<ApiResponse<List<AppTrendPointDto>>>> GetTrend(
        [FromQuery] Guid companyId,
        [FromQuery] string? period,
        [FromQuery] string? from,
        [FromQuery] string? to,
        CancellationToken ct)
    {
        var (start, end) = ParsePeriod(period, from, to);
        var query = new RecruiterStatsQuery(companyId, start, end);
        var result = await _svc.GetApplicationTrendAsync(query, ct);
        return Ok(ApiResponse<List<AppTrendPointDto>>.Ok(result));
    }

    // ── GET /api/recruiter-stats/hot-skills?companyId=... ─────────────────
    [HttpGet("hot-skills")]
    public async Task<ActionResult<ApiResponse<List<CandSkillStatDto>>>> GetHotSkills(
        [FromQuery] Guid companyId, CancellationToken ct)
    {
        var result = await _svc.GetHotSkillsAsync(companyId, ct);
        return Ok(ApiResponse<List<CandSkillStatDto>>.Ok(result));
    }

    // ── GET /api/recruiter-stats/job-performance?companyId=...&period=30d ─
    [HttpGet("job-performance")]
    public async Task<ActionResult<ApiResponse<List<JobPerformanceDto>>>> GetJobPerformance(
        [FromQuery] Guid companyId,
        [FromQuery] string? period,
        [FromQuery] string? from,
        [FromQuery] string? to,
        CancellationToken ct)
    {
        var (start, end) = ParsePeriod(period, from, to);
        var query = new RecruiterStatsQuery(companyId, start, end);
        var result = await _svc.GetJobPerformanceAsync(query, ct);
        return Ok(ApiResponse<List<JobPerformanceDto>>.Ok(result));
    }
}

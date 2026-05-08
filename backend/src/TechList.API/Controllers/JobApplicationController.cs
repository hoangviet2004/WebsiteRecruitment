using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Applications.Interfaces;
using TechList.Application.Applications.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/applications")]
public sealed class JobApplicationController : ControllerBase
{
    private readonly IJobApplicationService _service;

    public JobApplicationController(IJobApplicationService service)
    {
        _service = service;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    // ── Candidate: Nộp đơn ứng tuyển ───────────────────────
    [HttpPost]
    [Authorize(Roles = "Candidate")]
    public async Task<ActionResult<ApiResponse<JobApplicationDto>>> Apply(
        [FromBody] CreateApplicationRequest request, CancellationToken ct)
    {
        var result = await _service.ApplyAsync(GetUserId(), request, ct);
        return Ok(ApiResponse<JobApplicationDto>.Ok(result, "Nộp đơn ứng tuyển thành công!"));
    }

    // ── Candidate: Xem danh sách đơn đã nộp ────────────────
    [HttpGet("my-applications")]
    [Authorize(Roles = "Candidate")]
    public async Task<ActionResult<ApiResponse<List<JobApplicationDto>>>> GetMyApplications(CancellationToken ct)
    {
        var result = await _service.GetMyApplicationsAsync(GetUserId(), ct);
        return Ok(ApiResponse<List<JobApplicationDto>>.Ok(result));
    }

    // ── Recruiter: Xem đơn theo job ─────────────────────────
    [HttpGet("job/{jobPostId:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<List<JobApplicationDto>>>> GetByJob(Guid jobPostId, CancellationToken ct)
    {
        var result = await _service.GetByJobAsync(GetUserId(), jobPostId, ct);
        return Ok(ApiResponse<List<JobApplicationDto>>.Ok(result));
    }

    // ── Recruiter: Xem tất cả đơn của company ───────────────
    [HttpGet("company/{companyId:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<List<JobApplicationDto>>>> GetByCompany(Guid companyId, CancellationToken ct)
    {
        var result = await _service.GetByCompanyAsync(GetUserId(), companyId, ct);
        return Ok(ApiResponse<List<JobApplicationDto>>.Ok(result));
    }

    // ── Recruiter: Cập nhật trạng thái đơn ─────────────────
    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<JobApplicationDto>>> UpdateStatus(
        Guid id, [FromBody] UpdateApplicationStatusRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateStatusAsync(GetUserId(), id, request.Status, ct);
        return Ok(ApiResponse<JobApplicationDto>.Ok(result, "Cập nhật trạng thái thành công!"));
    }

    // ── Recruiter/Candidate: Xem chi tiết đơn ───────────────
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Recruiter,Candidate")]
    public async Task<ActionResult<ApiResponse<JobApplicationDto>>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(GetUserId(), id, ct);
        return Ok(ApiResponse<JobApplicationDto>.Ok(result));
    }

    [HttpGet("check/{jobPostId:guid}")]
    [Authorize(Roles = "Candidate")]
    public async Task<ActionResult<ApiResponse<bool>>> CheckApplied(Guid jobPostId, CancellationToken ct)
    {
        var result = await _service.CheckAppliedAsync(GetUserId(), jobPostId, ct);
        return Ok(ApiResponse<bool>.Ok(result));
    }
}

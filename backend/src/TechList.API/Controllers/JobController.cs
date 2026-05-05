using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Jobs.Interfaces;
using TechList.Application.Jobs.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/jobs")]
public sealed class JobController : ControllerBase
{
    private readonly IJobService _jobService;

    public JobController(IJobService jobService)
    {
        _jobService = jobService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<JobDto>>>> GetActiveJobs(CancellationToken ct)
    {
        var result = await _jobService.GetActiveJobsAsync(ct);
        return Ok(ApiResponse<List<JobDto>>.Ok(result));
    }

    [HttpGet("company/{companyId:guid}")]
    public async Task<ActionResult<ApiResponse<List<JobDto>>>> GetByCompany(Guid companyId, CancellationToken ct)
    {
        var result = await _jobService.GetJobsByCompanyAsync(companyId, ct);
        return Ok(ApiResponse<List<JobDto>>.Ok(result));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<JobDto>>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _jobService.GetJobByIdAsync(id, ct);
        return Ok(ApiResponse<JobDto>.Ok(result));
    }

    [HttpPost]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<JobDto>>> Create([FromBody] CreateJobRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var result = await _jobService.CreateJobAsync(userId!, request, ct);
        return Ok(ApiResponse<JobDto>.Ok(result, "Job posted successfully"));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<JobDto>>> Update(Guid id, [FromBody] UpdateJobRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        try
        {
            var result = await _jobService.UpdateJobAsync(userId!, id, request, ct);
            return Ok(ApiResponse<JobDto>.Ok(result, "Job updated successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<JobDto>.Fail(ex.Message));
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Recruiter,Admin")] // Allow both recruiter owners and admins to delete
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        await _jobService.DeleteJobAsync(userId!, id, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Job deleted successfully"));
    }
}

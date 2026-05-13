using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.JobRecommendation.Interfaces;
using TechList.Application.JobRecommendation.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/job-recommendations")]
public sealed class JobRecommendationController : ControllerBase
{
    private readonly IJobRecommendationService _service;

    public JobRecommendationController(IJobRecommendationService service)
    {
        _service = service;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    [HttpPost]
    [Authorize(Roles = "Candidate")]
    public async Task<ActionResult<ApiResponse<JobRecommendationResult>>> Recommend(CancellationToken ct)
    {
        var result = await _service.RecommendAsync(GetUserId(), ct);
        return Ok(ApiResponse<JobRecommendationResult>.Ok(result, "Gợi ý việc làm thành công!"));
    }
}

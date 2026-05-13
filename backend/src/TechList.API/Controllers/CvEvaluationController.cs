using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.CvEvaluation.Interfaces;
using TechList.Application.CvEvaluation.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/cv-evaluation")]
public sealed class CvEvaluationController : ControllerBase
{
    private readonly ICvEvaluationService _service;

    public CvEvaluationController(ICvEvaluationService service)
    {
        _service = service;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    [HttpPost("{applicationId:guid}")]
    [Authorize(Roles = "Recruiter")]
    public async Task<ActionResult<ApiResponse<CvEvaluationResult>>> Evaluate(
        Guid applicationId, CancellationToken ct)
    {
        var result = await _service.EvaluateCvAsync(applicationId, GetUserId(), ct);
        return Ok(ApiResponse<CvEvaluationResult>.Ok(result, "Đánh giá CV thành công!"));
    }
}

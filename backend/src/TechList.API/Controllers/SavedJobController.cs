using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.SavedJobs.Interfaces;
using TechList.Application.SavedJobs.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/saved-jobs")]
[Authorize(Roles = "Candidate")]
public sealed class SavedJobController : ControllerBase
{
    private readonly ISavedJobService _savedJobService;

    public SavedJobController(ISavedJobService savedJobService)
    {
        _savedJobService = savedJobService;
    }

    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? throw new UnauthorizedAccessException();

    // GET api/saved-jobs
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SavedJobDto>>>> GetAll(CancellationToken ct)
    {
        var result = await _savedJobService.GetSavedJobsAsync(UserId, ct);
        return Ok(ApiResponse<List<SavedJobDto>>.Ok(result));
    }

    // POST api/saved-jobs
    [HttpPost]
    public async Task<ActionResult<ApiResponse<SavedJobDto>>> Save(
        [FromBody] SaveJobRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _savedJobService.SaveJobAsync(UserId, request, ct);
            return Ok(ApiResponse<SavedJobDto>.Ok(result, "Đã lưu tin tuyển dụng vào danh sách yêu thích."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<SavedJobDto>.Fail(ex.Message));
        }
    }

    // PUT api/saved-jobs/{id}
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCollection(
        Guid id, [FromBody] UpdateCollectionRequest request, CancellationToken ct)
    {
        try
        {
            await _savedJobService.UpdateCollectionAsync(UserId, id, request, ct);
            return Ok(ApiResponse<object>.Ok(null!, "Đã cập nhật nhóm."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // DELETE api/saved-jobs/{id}
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Remove(Guid id, CancellationToken ct)
    {
        try
        {
            await _savedJobService.RemoveSavedJobAsync(UserId, id, ct);
            return Ok(ApiResponse<object>.Ok(null!, "Đã bỏ lưu tin tuyển dụng."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // GET api/saved-jobs/check/{jobPostId}
    // Trả về { isSaved, savedJobId } để frontend có thể xóa đúng record
    [HttpGet("check/{jobPostId:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> CheckSaved(Guid jobPostId, CancellationToken ct)
    {
        var result = await _savedJobService.GetSavedJobIdAsync(UserId, jobPostId, ct);
        return Ok(ApiResponse<object>.Ok(new { isSaved = result.HasValue, savedJobId = result }));
    }
}

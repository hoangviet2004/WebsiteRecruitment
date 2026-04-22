using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Profiles.Interfaces;
using TechList.Application.Profiles.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController : ControllerBase
{
    private readonly IProfileService _profiles;

    public ProfileController(IProfileService profiles)
    {
        _profiles = profiles;
    }

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> Me(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        var profile = await _profiles.GetMyProfileAsync(userId, ct);
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    [HttpPut("me")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UpdateMe([FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        var profile = await _profiles.UpdateMyProfileAsync(userId, request, ct);
        return Ok(ApiResponse<ProfileDto>.Ok(profile, "Profile updated"));
    }

    [HttpPost("avatar")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UploadAvatar(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new InvalidOperationException("File is required");

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        await using var stream = file.OpenReadStream();
        var profile = await _profiles.UpdateAvatarAsync(userId, stream, file.FileName, ct);
        return Ok(ApiResponse<ProfileDto>.Ok(profile, "Avatar updated"));
    }

    [HttpPost("cv")]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UploadCv(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new InvalidOperationException("File is required");

        if (file.ContentType != "application/pdf")
            return BadRequest(ApiResponse<object>.Fail("Chỉ hỗ trợ file định dạng PDF"));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        await using var stream = file.OpenReadStream();
        var profile = await _profiles.UpdateCvAsync(userId, stream, file.FileName, ct);
        return Ok(ApiResponse<ProfileDto>.Ok(profile, "CV uploaded successfully"));
    }
}


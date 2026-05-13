using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Profiles.Interfaces;
using TechList.Application.Profiles.Models;
using TechList.Infrastructure.Identity;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController : ControllerBase
{
    private readonly IProfileService _profiles;
    private readonly UserManager<ApplicationUser> _userManager;

    public ProfileController(IProfileService profiles, UserManager<ApplicationUser> userManager)
    {
        _profiles = profiles;
        _userManager = userManager;
    }

    // ── Public profile (không cần đăng nhập) ────────────────────
    [HttpGet("public/{userId}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> GetPublic(string userId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return BadRequest(ApiResponse<object>.Fail("userId không hợp lệ"));

        var profile = await _profiles.GetPublicProfileAsync(userId, ct);
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> Me(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        var profile = await _profiles.GetMyProfileAsync(userId, ct);

        var user = await _userManager.FindByIdAsync(userId);
        var hasPassword = user is not null && await _userManager.HasPasswordAsync(user);

        return Ok(ApiResponse<ProfileDto>.Ok(profile with { HasPassword = hasPassword }));
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

    [HttpGet("{userId}/cv-view")]
    public async Task<ActionResult<ApiResponse<object>>> GetCvViewUrlByUser(string userId, CancellationToken ct)
    {
        var url = await _profiles.GetCvViewUrlByUserIdAsync(userId, ct);
        return Ok(ApiResponse<object>.Ok(new { url }));
    }

    [HttpGet("cv/download")]
    public async Task<ActionResult<ApiResponse<object>>> GetCvDownloadUrl(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        var url = await _profiles.GetCvDownloadUrlAsync(userId, ct);
        return Ok(ApiResponse<object>.Ok(new { url }));
    }

    [HttpGet("cv/view")]
    public async Task<ActionResult<ApiResponse<object>>> GetCvViewUrl(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        var url = await _profiles.GetCvViewUrlAsync(userId, ct);
        return Ok(ApiResponse<object>.Ok(new { url }));
    }

    [HttpPost("change-password")]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException("Missing user id");

        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new InvalidOperationException("Không tìm thấy người dùng.");

        // Tài khoản đăng nhập bằng OAuth không có mật khẩu
        var hasPassword = await _userManager.HasPasswordAsync(user);
        if (!hasPassword)
            return BadRequest(ApiResponse<object>.Fail("Tài khoản này sử dụng đăng nhập qua Google/GitHub nên không có mật khẩu để đổi."));

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join(" ", result.Errors.Select(e => e.Description));
            return BadRequest(ApiResponse<object>.Fail(errors));
        }

        return Ok(ApiResponse<object>.Ok(null!, "Đổi mật khẩu thành công."));
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


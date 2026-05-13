using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Messaging.Interfaces;
using TechList.Application.Messaging.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/support-messaging")]
[Authorize]
public sealed class SupportMessagingController : ControllerBase
{
    private readonly ISupportMessagingService _support;

    public SupportMessagingController(ISupportMessagingService support)
    {
        _support = support;
    }

    private string Me =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    [HttpGet("conversation-info")]
    public async Task<ActionResult<ApiResponse<ConversationDto>>> GetConversationInfo(CancellationToken ct)
    {
        var result = await _support.GetAdminConversationAsync(Me, ct);
        return Ok(ApiResponse<ConversationDto>.Ok(result));
    }

    [HttpGet("thread")]
    public async Task<ActionResult<ApiResponse<List<SupportMessageDto>>>> GetThread(CancellationToken ct)
    {
        var result = await _support.GetSupportThreadAsync(Me, ct);
        return Ok(ApiResponse<List<SupportMessageDto>>.Ok(result));
    }

    [HttpPost("send")]
    public async Task<ActionResult<ApiResponse<SupportMessageDto>>> Send(
        [FromBody] SendSupportMessageRequest request, CancellationToken ct)
    {
        var result = await _support.SendFromUserAsync(Me, request.Content, ct);
        return Ok(ApiResponse<SupportMessageDto>.Ok(result, "Đã gửi tin nhắn đến Admin"));
    }

    [HttpPost("read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkRead(CancellationToken ct)
    {
        await _support.MarkSupportReadByUserAsync(Me, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Đã đánh dấu đã đọc"));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount(CancellationToken ct)
    {
        var count = await _support.GetSupportUnreadCountAsync(Me, ct);
        return Ok(ApiResponse<int>.Ok(count));
    }

    // --- ADMIN SIDE ---

    [HttpGet("admin/conversations")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<ConversationDto>>>> GetAdminConversations(CancellationToken ct)
    {
        var result = await _support.GetAllSupportConversationsAsync(ct);
        return Ok(ApiResponse<List<ConversationDto>>.Ok(result));
    }

    [HttpGet("admin/thread/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<SupportMessageDto>>>> GetAdminThread(string userId, CancellationToken ct)
    {
        var result = await _support.GetSupportThreadAsync(userId, ct);
        return Ok(ApiResponse<List<SupportMessageDto>>.Ok(result));
    }

    [HttpPost("admin/send")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<SupportMessageDto>>> SendFromAdmin(
        [FromBody] AdminSendSupportRequest request, CancellationToken ct)
    {
        var result = await _support.SendFromAdminAsync(Me, request.TargetUserId, request.Content, ct);
        return Ok(ApiResponse<SupportMessageDto>.Ok(result, "Đã gửi tin nhắn đến người dùng"));
    }

    [HttpPost("admin/read/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<object>>> MarkReadByAdmin(string userId, CancellationToken ct)
    {
        await _support.MarkSupportReadByAdminAsync(Me, userId, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Đã đánh dấu đã đọc"));
    }
}

public record AdminSendSupportRequest(string TargetUserId, string Content);

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Notifications.Interfaces;
using TechList.Application.Notifications.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<NotificationDto>>>> GetMyNotifications(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var result = await _notificationService.GetForUserAsync(userId!, ct);
        return Ok(ApiResponse<List<NotificationDto>>.Ok(result));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var count = await _notificationService.CountUnreadAsync(userId!, ct);
        return Ok(ApiResponse<int>.Ok(count));
    }

    [HttpPut("mark-read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkAllRead(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        await _notificationService.MarkAllReadAsync(userId!, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Marked as read"));
    }
}

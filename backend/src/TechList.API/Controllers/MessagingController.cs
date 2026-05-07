using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.Messaging.Interfaces;
using TechList.Application.Messaging.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/messaging")]
[Authorize(Roles = "Recruiter")]
public sealed class MessagingController : ControllerBase
{
    private readonly IMessagingService _msg;
    private readonly IInterviewService _interview;

    public MessagingController(IMessagingService msg, IInterviewService interview)
    {
        _msg       = msg;
        _interview = interview;
    }

    private string Me =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    // ── Conversations ────────────────────────────────────────────────────

    [HttpGet("conversations")]
    public async Task<ActionResult<ApiResponse<List<ConversationDto>>>> GetConversations(
        [FromQuery] Guid companyId, CancellationToken ct)
    {
        var result = await _msg.GetConversationsAsync(Me, companyId, ct);
        return Ok(ApiResponse<List<ConversationDto>>.Ok(result));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount(
        [FromQuery] Guid companyId, CancellationToken ct)
    {
        var count = await _msg.GetUnreadCountAsync(Me, companyId, ct);
        return Ok(ApiResponse<int>.Ok(count));
    }

    // ── Thread ───────────────────────────────────────────────────────────

    [HttpGet("thread/{applicationId:guid}")]
    public async Task<ActionResult<ApiResponse<List<MessageDto>>>> GetThread(
        Guid applicationId, CancellationToken ct)
    {
        var result = await _msg.GetThreadAsync(Me, applicationId, ct);
        return Ok(ApiResponse<List<MessageDto>>.Ok(result));
    }

    [HttpPost("thread/{applicationId:guid}/read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkRead(
        Guid applicationId, CancellationToken ct)
    {
        await _msg.MarkThreadReadAsync(Me, applicationId, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Đã đánh dấu đã đọc"));
    }

    // ── Send message ─────────────────────────────────────────────────────

    [HttpPost("send")]
    public async Task<ActionResult<ApiResponse<MessageDto>>> Send(
        [FromBody] SendMessageRequest request, CancellationToken ct)
    {
        var result = await _msg.SendMessageAsync(Me, request, ct);
        return Ok(ApiResponse<MessageDto>.Ok(result, "Đã gửi tin nhắn"));
    }

    // ── Candidate info panel ─────────────────────────────────────────────

    [HttpGet("candidate-info/{applicationId:guid}")]
    public async Task<ActionResult<ApiResponse<CandidateInfoDto>>> GetCandidateInfo(
        Guid applicationId, CancellationToken ct)
    {
        var result = await _msg.GetCandidateInfoAsync(Me, applicationId, ct);
        return Ok(ApiResponse<CandidateInfoDto>.Ok(result));
    }

    // ── Interview scheduling ─────────────────────────────────────────────

    [HttpPost("interviews")]
    public async Task<ActionResult<ApiResponse<InterviewScheduleDto>>> Schedule(
        [FromBody] ScheduleInterviewRequest request, CancellationToken ct)
    {
        var result = await _interview.ScheduleAsync(Me, request, ct);
        return Ok(ApiResponse<InterviewScheduleDto>.Ok(result, "Đã lên lịch phỏng vấn thành công!"));
    }

    [HttpGet("interviews/upcoming")]
    public async Task<ActionResult<ApiResponse<List<InterviewScheduleDto>>>> GetUpcoming(
        [FromQuery] Guid companyId, CancellationToken ct)
    {
        var result = await _interview.GetUpcomingAsync(Me, companyId, ct);
        return Ok(ApiResponse<List<InterviewScheduleDto>>.Ok(result));
    }

    [HttpPost("interviews/{scheduleId:guid}/cancel")]
    public async Task<ActionResult<ApiResponse<InterviewScheduleDto>>> Cancel(
        Guid scheduleId, CancellationToken ct)
    {
        var result = await _interview.CancelAsync(Me, scheduleId, ct);
        return Ok(ApiResponse<InterviewScheduleDto>.Ok(result, "Đã hủy lịch phỏng vấn"));
    }
}

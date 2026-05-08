using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechList.API.Common;
using TechList.Application.CandidateMessaging.Interfaces;
using TechList.Application.CandidateMessaging.Models;

namespace TechList.API.Controllers;

[ApiController]
[Route("api/candidate/messages")]
[Authorize(Roles = "Candidate")]
public sealed class CandidateMessagingController : ControllerBase
{
    private readonly ICandidateMessagingService _svc;
    public CandidateMessagingController(ICandidateMessagingService svc) => _svc = svc;

    private string Me =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    // GET /api/candidate/messages/conversations
    [HttpGet("conversations")]
    public async Task<ActionResult<ApiResponse<List<CandidateConversationDto>>>> GetConversations(CancellationToken ct)
    {
        var result = await _svc.GetConversationsAsync(Me, ct);
        return Ok(ApiResponse<List<CandidateConversationDto>>.Ok(result));
    }

    // GET /api/candidate/messages/unread-count
    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount(CancellationToken ct)
    {
        var count = await _svc.GetUnreadCountAsync(Me, ct);
        return Ok(ApiResponse<int>.Ok(count));
    }

    // GET /api/candidate/messages/thread/{applicationId}
    [HttpGet("thread/{applicationId:guid}")]
    public async Task<ActionResult<ApiResponse<List<CandidateMessageDto>>>> GetThread(
        Guid applicationId, CancellationToken ct)
    {
        var result = await _svc.GetThreadAsync(Me, applicationId, ct);
        return Ok(ApiResponse<List<CandidateMessageDto>>.Ok(result));
    }

    // POST /api/candidate/messages/thread/{applicationId}/read
    [HttpPost("thread/{applicationId:guid}/read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkRead(Guid applicationId, CancellationToken ct)
    {
        await _svc.MarkReadAsync(Me, applicationId, ct);
        return Ok(ApiResponse<object>.Ok(null!, "Đã đánh dấu đã đọc"));
    }

    // POST /api/candidate/messages/send
    [HttpPost("send")]
    public async Task<ActionResult<ApiResponse<CandidateMessageDto>>> Send(
        [FromBody] SendCandidateMessageRequest req, CancellationToken ct)
    {
        var result = await _svc.SendMessageAsync(Me, req, ct);
        return Ok(ApiResponse<CandidateMessageDto>.Ok(result, "Đã gửi tin nhắn"));
    }

    // GET /api/candidate/messages/recruiter-panel/{applicationId}
    [HttpGet("recruiter-panel/{applicationId:guid}")]
    public async Task<ActionResult<ApiResponse<RecruiterPanelDto>>> GetRecruiterPanel(
        Guid applicationId, CancellationToken ct)
    {
        var result = await _svc.GetRecruiterPanelAsync(Me, applicationId, ct);
        return Ok(ApiResponse<RecruiterPanelDto>.Ok(result));
    }

    // POST /api/candidate/messages/interviews/{scheduleId}/respond
    [HttpPost("interviews/{scheduleId:guid}/respond")]
    public async Task<ActionResult<ApiResponse<InterviewCardDto>>> RespondInterview(
        Guid scheduleId, [FromBody] InterviewResponseRequest req, CancellationToken ct)
    {
        var result = await _svc.RespondToInterviewAsync(Me, scheduleId, req, ct);
        return Ok(ApiResponse<InterviewCardDto>.Ok(result, "Đã phản hồi lời mời phỏng vấn!"));
    }

    // POST /api/candidate/messages/offers/{offerId}/respond
    [HttpPost("offers/{offerId:guid}/respond")]
    public async Task<ActionResult<ApiResponse<OfferCardDto>>> RespondOffer(
        Guid offerId, [FromBody] OfferResponseRequest req, CancellationToken ct)
    {
        var result = await _svc.RespondToOfferAsync(Me, offerId, req, ct);
        return Ok(ApiResponse<OfferCardDto>.Ok(result, "Đã phản hồi offer!"));
    }
}

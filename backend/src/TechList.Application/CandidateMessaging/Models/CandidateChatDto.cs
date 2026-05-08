namespace TechList.Application.CandidateMessaging.Models;

// ── Conversation list (cột trái) ────────────────────────────
public record CandidateConversationDto(
    Guid ApplicationId,
    Guid JobPostId,
    string JobTitle,
    string RecruiterName,
    string? RecruiterAvatar,
    string CompanyName,
    string? CompanyLogo,
    string ApplicationStatus,
    string? LastMessage,
    string LastMessageType,
    DateTime? LastMessageAt,
    bool HasUnread,
    int UnreadCount
);

// ── Tin nhắn trong thread ───────────────────────────────────
public record CandidateMessageDto(
    Guid Id,
    Guid ApplicationId,
    string SenderId,
    string SenderName,
    string? SenderAvatar,
    bool IsFromMe,           // true = candidate gửi
    string Content,
    string Type,             // message | email | system_notify | interview_invite | offer
    string? RefId,           // scheduleId hoặc offerId
    bool IsRead,
    DateTime SentAt,
    // Dữ liệu đặc biệt (chỉ non-null với type phù hợp)
    InterviewCardDto? InterviewCard,
    OfferCardDto? OfferCard
);

// ── Card lời mời phỏng vấn ──────────────────────────────────
public record InterviewCardDto(
    Guid ScheduleId,
    string JobTitle,
    DateTime ScheduledAt,
    int DurationMinutes,
    string? MeetingLink,
    string? Location,
    string? Notes,
    string ScheduleStatus,      // Scheduled | Cancelled | Completed
    string CandidateResponse,   // Pending | Accepted | Declined
    string? DeclineReason
);

// ── Card offer ──────────────────────────────────────────────
public record OfferCardDto(
    Guid OfferId,
    string JobTitle,
    string CompanyName,
    decimal? Salary,
    DateTime? StartDate,
    DateTime? ResponseDeadline,
    string? Notes,
    string Status,              // Pending | Accepted | Declined | Negotiating
    string? DeclineReason
);

// ── Thông tin recruiter (panel phải) ────────────────────────
public record RecruiterPanelDto(
    string RecruiterId,
    string RecruiterName,
    string? RecruiterAvatar,
    string RecruiterEmail,
    string CompanyName,
    string? CompanyLogo,
    string? CompanyWebsite,
    string ApplicationStatus,
    string JobTitle,
    InterviewCardDto? UpcomingInterview,
    OfferCardDto? PendingOffer
);

// ── Requests ────────────────────────────────────────────────
public class SendCandidateMessageRequest
{
    public Guid ApplicationId { get; set; }
    public string Content { get; set; } = default!;
    public string Type { get; set; } = "message"; // message | email
}

public class InterviewResponseRequest
{
    // "Accepted" | "Declined"
    public string Response { get; set; } = default!;
    public string? DeclineReason { get; set; }
}

public class OfferResponseRequest
{
    // "Accepted" | "Declined" | "Negotiating"
    public string Response { get; set; } = default!;
    public string? DeclineReason { get; set; }
}

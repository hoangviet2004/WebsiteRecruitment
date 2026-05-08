namespace TechList.Application.Messaging.Models;

// ── Tin nhắn đơn lẻ ────────────────────────────────────────
public record MessageDto(
    Guid Id,
    Guid ApplicationId,
    string SenderId,
    string SenderName,
    string? SenderAvatar,
    string Content,
    string Type,
    bool IsRead,
    DateTime SentAt
);

// ── Conversation item (danh sách bên trái) ─────────────────
public record ConversationDto(
    Guid ApplicationId,
    Guid JobPostId,
    string JobTitle,
    string CandidateId,
    string CandidateName,
    string CandidateEmail,
    string? CandidateAvatar,
    string? CandidateSkills,
    string ApplicationStatus,
    string? LastMessage,
    string? LastMessageType,
    DateTime? LastMessageAt,
    bool HasUnread,
    int UnreadCount
);

// ── Candidate info panel (cột phải) ────────────────────────
public record CandidateInfoDto(
    string CandidateId,
    string CandidateName,
    string CandidateEmail,
    string? CandidateAvatar,
    string? CvUrl,
    string? Skills,
    string ApplicationStatus,
    Guid ApplicationId,
    string JobTitle,
    InterviewScheduleDto? UpcomingInterview
);

// ── Request gửi tin ────────────────────────────────────────
public class SendMessageRequest
{
    public Guid ApplicationId { get; set; }
    public string Content { get; set; } = default!;
    public string Type { get; set; } = "message";  // "message" | "email"
}

// ── Lịch phỏng vấn ─────────────────────────────────────────
public record InterviewScheduleDto(
    Guid Id,
    Guid ApplicationId,
    string JobTitle,
    string CandidateName,
    DateTime ScheduledAt,
    int DurationMinutes,
    string? MeetingLink,
    string? Location,
    string? Notes,
    string Status
);

// ── Request tạo lịch phỏng vấn ─────────────────────────────
public class ScheduleInterviewRequest
{
    public Guid ApplicationId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public string? MeetingLink { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
}

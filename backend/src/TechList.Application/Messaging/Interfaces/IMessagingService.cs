using TechList.Application.Messaging.Models;

namespace TechList.Application.Messaging.Interfaces;

public interface IMessagingService
{
    // Danh sách conversations của recruiter (cho cột trái)
    Task<List<ConversationDto>> GetConversationsAsync(string recruiterId, Guid companyId, CancellationToken ct);

    // Thread tin nhắn theo applicationId
    Task<List<MessageDto>> GetThreadAsync(string recruiterId, Guid applicationId, CancellationToken ct);

    // Gửi tin nhắn
    Task<MessageDto> SendMessageAsync(string senderId, SendMessageRequest request, CancellationToken ct);

    // Đánh dấu đã đọc toàn bộ thread
    Task MarkThreadReadAsync(string recruiterId, Guid applicationId, CancellationToken ct);

    // Thông tin ứng viên cho panel phải
    Task<CandidateInfoDto> GetCandidateInfoAsync(string recruiterId, Guid applicationId, CancellationToken ct);

    // Đếm tổng tin chưa đọc (badge)
    Task<int> GetUnreadCountAsync(string recruiterId, Guid companyId, CancellationToken ct);
}

public interface IInterviewService
{
    Task<InterviewScheduleDto> ScheduleAsync(string recruiterId, ScheduleInterviewRequest request, CancellationToken ct);
    Task<List<InterviewScheduleDto>> GetUpcomingAsync(string recruiterId, Guid companyId, CancellationToken ct);
    Task<InterviewScheduleDto> CancelAsync(string recruiterId, Guid scheduleId, CancellationToken ct);
}

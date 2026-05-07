using TechList.Application.CandidateMessaging.Models;

namespace TechList.Application.CandidateMessaging.Interfaces;

public interface ICandidateMessagingService
{
    Task<List<CandidateConversationDto>> GetConversationsAsync(string candidateId, CancellationToken ct);
    Task<List<CandidateMessageDto>> GetThreadAsync(string candidateId, Guid applicationId, CancellationToken ct);
    Task<CandidateMessageDto> SendMessageAsync(string candidateId, SendCandidateMessageRequest req, CancellationToken ct);
    Task MarkReadAsync(string candidateId, Guid applicationId, CancellationToken ct);
    Task<RecruiterPanelDto> GetRecruiterPanelAsync(string candidateId, Guid applicationId, CancellationToken ct);
    Task<int> GetUnreadCountAsync(string candidateId, CancellationToken ct);

    // Interview & Offer responses
    Task<InterviewCardDto> RespondToInterviewAsync(string candidateId, Guid scheduleId, InterviewResponseRequest req, CancellationToken ct);
    Task<OfferCardDto> RespondToOfferAsync(string candidateId, Guid offerId, OfferResponseRequest req, CancellationToken ct);
}

using TechList.Application.Messaging.Models;

namespace TechList.Application.Messaging.Interfaces;

public interface ISupportMessagingService
{
    Task<List<SupportMessageDto>> GetSupportThreadAsync(string userId, CancellationToken ct);
    Task<ConversationDto> GetAdminConversationAsync(string userId, CancellationToken ct);
    Task<List<ConversationDto>> GetAllSupportConversationsAsync(CancellationToken ct);
    Task<SupportMessageDto> SendFromUserAsync(string userId, string content, CancellationToken ct);
    Task<SupportMessageDto> SendFromAdminAsync(string adminId, string targetUserId, string content, CancellationToken ct);
    Task MarkSupportReadByUserAsync(string userId, CancellationToken ct);
    Task MarkSupportReadByAdminAsync(string adminId, string targetUserId, CancellationToken ct);
    Task<int> GetSupportUnreadCountAsync(string userId, CancellationToken ct);
}

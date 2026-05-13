using TechList.Application.Notifications.Models;

namespace TechList.Application.Notifications.Interfaces;

public interface INotificationService
{
    Task CreateAsync(string userId, string title, string message, string type, Guid? jobPostId, string? jobTitle, CancellationToken ct);
    Task<List<NotificationDto>> GetForUserAsync(string userId, CancellationToken ct);
    Task MarkAllReadAsync(string userId, CancellationToken ct);
    Task<int> CountUnreadAsync(string userId, CancellationToken ct);
}

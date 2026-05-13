using Microsoft.EntityFrameworkCore;
using TechList.Application.Notifications.Interfaces;
using TechList.Application.Notifications.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Notifications;

public sealed class NotificationService : INotificationService
{
    private readonly AppDbContext _db;

    public NotificationService(AppDbContext db)
    {
        _db = db;
    }

    public async Task CreateAsync(string userId, string title, string message, string type, Guid? jobPostId, string? jobTitle, CancellationToken ct)
    {
        _db.Notifications.Add(new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            JobPostId = jobPostId,
            JobTitle = jobTitle,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<NotificationDto>> GetForUserAsync(string userId, CancellationToken ct)
    {
        var items = await _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        return items.Select(n => new NotificationDto(
            n.Id, n.Title, n.Message, n.Type, n.JobPostId, n.JobTitle, n.IsRead, n.CreatedAt
        )).ToList();
    }

    public async Task MarkAllReadAsync(string userId, CancellationToken ct)
    {
        await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
    }

    public async Task<int> CountUnreadAsync(string userId, CancellationToken ct)
    {
        return await _db.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead, ct);
    }
}

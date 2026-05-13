using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TechList.Application.Messaging.Interfaces;
using TechList.Application.Messaging.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Messaging;

public sealed class SupportMessagingService : ISupportMessagingService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public SupportMessagingService(AppDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<List<SupportMessageDto>> GetSupportThreadAsync(string userId, CancellationToken ct)
    {
        var msgs = await _db.SupportMessages.AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderBy(m => m.SentAt)
            .ToListAsync(ct);

        if (!msgs.Any()) return new();

        var senderIds = msgs.Select(m => m.SenderId).Distinct().ToList();
        var users = await _userManager.Users.AsNoTracking()
            .Where(u => senderIds.Contains(u.Id))
            .ToListAsync(ct);
        var userMap = users.ToDictionary(u => u.Id);

        var profiles = await _db.UserProfiles.AsNoTracking()
            .Where(p => senderIds.Contains(p.UserId))
            .ToListAsync(ct);
        var profileMap = profiles.ToDictionary(p => p.UserId);

        return msgs.Select(m =>
        {
            var u = userMap.GetValueOrDefault(m.SenderId);
            var p = profileMap.GetValueOrDefault(m.SenderId);
            return new SupportMessageDto(
                m.Id, m.SenderId,
                p?.DisplayName ?? u?.FullName ?? "Admin",
                p?.AvatarUrl,
                m.Content, m.IsRead, m.SentAt
            );
        }).ToList();
    }

    public async Task<ConversationDto> GetAdminConversationAsync(string userId, CancellationToken ct)
    {
        // 1. Find the first admin user
        var adminRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Admin", ct);
        ApplicationUser? adminUser = null;
        if (adminRole != null)
        {
            var adminUserId = await _db.UserRoles
                .Where(ur => ur.RoleId == adminRole.Id)
                .Select(ur => ur.UserId)
                .FirstOrDefaultAsync(ct);
            if (adminUserId != null)
            {
                adminUser = await _userManager.FindByIdAsync(adminUserId);
            }
        }

        var profile = adminUser != null 
            ? await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == adminUser.Id, ct)
            : null;

        // 2. Get latest message and unread count
        var latestMsg = await _db.SupportMessages.AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.SentAt)
            .FirstOrDefaultAsync(ct);

        var unreadCount = await _db.SupportMessages.AsNoTracking()
            .Where(m => m.UserId == userId && m.SenderId != userId && !m.IsRead)
            .CountAsync(ct);

        return new ConversationDto(
            Guid.Empty, // Special ID for Support
            Guid.Empty,
            "Hỗ trợ hệ thống",
            adminUser?.Id ?? "admin",
            profile?.DisplayName ?? adminUser?.FullName ?? "Quản trị viên",
            adminUser?.Email ?? "admin@techlist.vn",
            profile?.AvatarUrl,
            null,
            "Active",
            latestMsg?.Content,
            "message",
            latestMsg?.SentAt,
            unreadCount > 0,
            unreadCount
        );
    }

    public async Task<List<ConversationDto>> GetAllSupportConversationsAsync(CancellationToken ct)
    {
        // 1. Get all unique UserIds from support messages
        var userIds = await _db.SupportMessages.AsNoTracking()
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync(ct);

        if (!userIds.Any()) return new();

        // 2. Fetch user info
        var users = await _userManager.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync(ct);
        var userMap = users.ToDictionary(u => u.Id);

        var profiles = await _db.UserProfiles.AsNoTracking()
            .Where(p => userIds.Contains(p.UserId))
            .ToListAsync(ct);
        var profileMap = profiles.ToDictionary(p => p.UserId);

        // 3. Get stats per user
        var stats = await _db.SupportMessages.AsNoTracking()
            .GroupBy(m => m.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                LastContent = g.OrderByDescending(m => m.SentAt).Select(m => m.Content).FirstOrDefault(),
                LastAt = (DateTime?)g.Max(m => m.SentAt),
                UnreadCount = g.Count(m => !m.IsRead && m.SenderId == m.UserId) // Admin hasn't read these
            })
            .ToListAsync(ct);

        var statMap = stats.ToDictionary(s => s.UserId);

        return userIds.Select(uid =>
        {
            var u = userMap.GetValueOrDefault(uid);
            var p = profileMap.GetValueOrDefault(uid);
            var s = statMap.GetValueOrDefault(uid);

            return new ConversationDto(
                Guid.Empty, // Admin side can use Guid.Empty + CandidateId to distinguish
                Guid.Empty,
                "Tin nhắn hỗ trợ",
                uid,
                p?.DisplayName ?? u?.FullName ?? "Người dùng",
                u?.Email ?? "",
                p?.AvatarUrl,
                null,
                "Active",
                s?.LastContent,
                "message",
                s?.LastAt,
                (s?.UnreadCount ?? 0) > 0,
                s?.UnreadCount ?? 0
            );
        })
        .OrderByDescending(c => c.LastMessageAt ?? DateTime.MinValue)
        .ToList();
    }

    public async Task<SupportMessageDto> SendFromUserAsync(string userId, string content, CancellationToken ct)
    {
        var msg = new SupportMessage
        {
            UserId = userId,
            SenderId = userId,
            Content = content.Trim(),
            SentAt = DateTime.UtcNow,
            IsRead = false
        };

        _db.SupportMessages.Add(msg);
        await _db.SaveChangesAsync(ct);

        var user = await _userManager.FindByIdAsync(userId);
        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);

        return new SupportMessageDto(
            msg.Id, msg.SenderId,
            profile?.DisplayName ?? user?.FullName ?? "Người dùng",
            profile?.AvatarUrl,
            msg.Content, msg.IsRead, msg.SentAt
        );
    }

    public async Task<SupportMessageDto> SendFromAdminAsync(string adminId, string targetUserId, string content, CancellationToken ct)
    {
        var msg = new SupportMessage
        {
            UserId = targetUserId,
            SenderId = adminId,
            Content = content.Trim(),
            SentAt = DateTime.UtcNow,
            IsRead = false
        };

        _db.SupportMessages.Add(msg);
        await _db.SaveChangesAsync(ct);

        var admin = await _userManager.FindByIdAsync(adminId);
        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == adminId, ct);

        return new SupportMessageDto(
            msg.Id, msg.SenderId,
            profile?.DisplayName ?? admin?.FullName ?? "Admin",
            profile?.AvatarUrl,
            msg.Content, msg.IsRead, msg.SentAt
        );
    }

    public async Task MarkSupportReadByUserAsync(string userId, CancellationToken ct)
    {
        await _db.SupportMessages
            .Where(m => m.UserId == userId && m.SenderId != userId && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true), ct);
    }

    public async Task MarkSupportReadByAdminAsync(string adminId, string targetUserId, CancellationToken ct)
    {
        await _db.SupportMessages
            .Where(m => m.UserId == targetUserId && m.SenderId == targetUserId && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true), ct);
    }

    public async Task<int> GetSupportUnreadCountAsync(string userId, CancellationToken ct)
    {
        return await _db.SupportMessages.AsNoTracking()
            .Where(m => m.UserId == userId && m.SenderId != userId && !m.IsRead)
            .CountAsync(ct);
    }
}

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TechList.Application.Messaging.Interfaces;
using TechList.Application.Messaging.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Messaging;

public sealed class MessagingService : IMessagingService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public MessagingService(AppDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // ── Danh sách conversations ───────────────────────────────────────────
    // Tránh N+1: load tất cả trong 4 queries, join in-memory
    public async Task<List<ConversationDto>> GetConversationsAsync(
        string recruiterId, Guid companyId, CancellationToken ct)
    {
        // 1. Job IDs của công ty
        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == companyId)
            .Select(j => new { j.Id, j.Title })
            .ToListAsync(ct);

        if (!jobIds.Any()) return new();

        var jobIdSet = jobIds.Select(j => j.Id).ToHashSet();
        var jobTitleMap = jobIds.ToDictionary(j => j.Id, j => j.Title);

        // 2. Tất cả applications + candidate info (batch)
        var apps = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIdSet.Contains(a.JobPostId))
            .Select(a => new { a.Id, a.JobPostId, a.CandidateId, a.Status })
            .ToListAsync(ct);

        if (!apps.Any()) return new();

        var appIdSet = apps.Select(a => a.Id).ToHashSet();
        var candidateIds = apps.Select(a => a.CandidateId).Distinct().ToList();

        // 3. User info (batch) — không N+1
        var users = await _userManager.Users.AsNoTracking()
            .Where(u => candidateIds.Contains(u.Id))
            .ToListAsync(ct);
        var userMap = users.ToDictionary(u => u.Id);

        var profiles = await _db.UserProfiles.AsNoTracking()
            .Where(p => candidateIds.Contains(p.UserId))
            .ToListAsync(ct);
        var profileMap = profiles.ToDictionary(p => p.UserId);

        // 4. Latest message per application + unread count (1 query)
        var msgStats = await _db.Messages.AsNoTracking()
            .Where(m => appIdSet.Contains(m.ApplicationId))
            .GroupBy(m => m.ApplicationId)
            .Select(g => new
            {
                ApplicationId = g.Key,
                LastContent   = g.OrderByDescending(m => m.SentAt).Select(m => m.Content).FirstOrDefault(),
                LastType      = g.OrderByDescending(m => m.SentAt).Select(m => m.Type).FirstOrDefault(),
                LastAt        = (DateTime?)g.Max(m => m.SentAt),
                UnreadCount   = g.Count(m => !m.IsRead && m.SenderId != recruiterId)
            })
            .ToListAsync(ct);

        var msgStatMap = msgStats.ToDictionary(s => s.ApplicationId);

        // Join in-memory
        var result = apps.Select(a =>
        {
            var u   = userMap.GetValueOrDefault(a.CandidateId);
            var p   = profileMap.GetValueOrDefault(a.CandidateId);
            var ms  = msgStatMap.GetValueOrDefault(a.Id);

            return new ConversationDto(
                a.Id,
                a.JobPostId,
                jobTitleMap.GetValueOrDefault(a.JobPostId, ""),
                a.CandidateId,
                p?.DisplayName ?? u?.FullName ?? u?.Email ?? "Ứng viên",
                u?.Email ?? "",
                p?.AvatarUrl,
                p?.Skills,
                a.Status,
                ms?.LastContent,
                ms?.LastType,
                ms?.LastAt,
                (ms?.UnreadCount ?? 0) > 0,
                ms?.UnreadCount ?? 0
            );
        })
        .OrderByDescending(c => c.LastMessageAt ?? DateTime.MinValue)
        .ToList();

        return result;
    }

    // ── Thread tin nhắn ──────────────────────────────────────────────────
    public async Task<List<MessageDto>> GetThreadAsync(
        string recruiterId, Guid applicationId, CancellationToken ct)
    {
        await VerifyRecruiterAccessAsync(recruiterId, applicationId, ct);

        var msgs = await _db.Messages.AsNoTracking()
            .Where(m => m.ApplicationId == applicationId)
            .OrderBy(m => m.SentAt)
            .Select(m => new { m.Id, m.SenderId, m.Content, m.Type, m.IsRead, m.SentAt })
            .ToListAsync(ct);

        if (!msgs.Any()) return new();

        // Batch load sender info
        var senderIds = msgs.Select(m => m.SenderId).Distinct().ToList();
        var senders   = await _userManager.Users.AsNoTracking()
            .Where(u => senderIds.Contains(u.Id))
            .ToListAsync(ct);
        var senderMap = senders.ToDictionary(u => u.Id);

        var profiles  = await _db.UserProfiles.AsNoTracking()
            .Where(p => senderIds.Contains(p.UserId))
            .ToListAsync(ct);
        var profileMap = profiles.ToDictionary(p => p.UserId);

        return msgs.Select(m =>
        {
            var u = senderMap.GetValueOrDefault(m.SenderId);
            var p = profileMap.GetValueOrDefault(m.SenderId);
            return new MessageDto(
                m.Id, applicationId, m.SenderId,
                p?.DisplayName ?? u?.FullName ?? "Người dùng",
                p?.AvatarUrl,
                m.Content, m.Type, m.IsRead, m.SentAt
            );
        }).ToList();
    }

    // ── Gửi tin nhắn ────────────────────────────────────────────────────
    public async Task<MessageDto> SendMessageAsync(
        string senderId, SendMessageRequest request, CancellationToken ct)
    {
        var app = await _db.JobApplications.AsNoTracking()
            .Include(a => a.JobPost).ThenInclude(j => j.Company)
            .FirstOrDefaultAsync(a => a.Id == request.ApplicationId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        // Kiểm tra quyền: phải là recruiter của công ty hoặc candidate của đơn
        var isRecruiter = app.JobPost.Company.OwnerId == senderId;
        var isCandidate = app.CandidateId == senderId;
        if (!isRecruiter && !isCandidate)
            throw new UnauthorizedAccessException("Bạn không có quyền gửi tin trong cuộc hội thoại này.");

        // Chặn gửi tin nếu công ty bị chặn
        if (app.JobPost.Company.IsBlocked)
            throw new InvalidOperationException("Công ty đã bị chặn. Không thể gửi tin nhắn trong cuộc hội thoại này.");

        var msg = new Message
        {
            Id            = Guid.NewGuid(),
            ApplicationId = request.ApplicationId,
            SenderId      = senderId,
            Content       = request.Content.Trim(),
            Type          = request.Type,
            IsRead        = false,
            SentAt        = DateTime.UtcNow
        };

        _db.Messages.Add(msg);
        await _db.SaveChangesAsync(ct);

        var sender = await _userManager.FindByIdAsync(senderId);
        var profile = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == senderId, ct);

        return new MessageDto(
            msg.Id, msg.ApplicationId, msg.SenderId,
            profile?.DisplayName ?? sender?.FullName ?? "Người dùng",
            profile?.AvatarUrl,
            msg.Content, msg.Type, msg.IsRead, msg.SentAt
        );
    }

    // ── Đánh dấu đã đọc ─────────────────────────────────────────────────
    public async Task MarkThreadReadAsync(
        string recruiterId, Guid applicationId, CancellationToken ct)
    {
        await _db.Messages
            .Where(m => m.ApplicationId == applicationId
                     && m.SenderId != recruiterId
                     && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true), ct);
    }

    // ── Candidate info panel ─────────────────────────────────────────────
    public async Task<CandidateInfoDto> GetCandidateInfoAsync(
        string recruiterId, Guid applicationId, CancellationToken ct)
    {
        var app = await _db.JobApplications.AsNoTracking()
            .Include(a => a.JobPost).ThenInclude(j => j.Company)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        if (app.JobPost.Company.OwnerId != recruiterId)
            throw new UnauthorizedAccessException("Bạn không có quyền xem thông tin này.");

        var user    = await _userManager.FindByIdAsync(app.CandidateId);
        var profile = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == app.CandidateId, ct);

        // Lịch phỏng vấn sắp tới gần nhất
        var upcoming = await _db.InterviewSchedules.AsNoTracking()
            .Where(s => s.ApplicationId == applicationId
                     && s.Status == "Scheduled"
                     && s.ScheduledAt > DateTime.UtcNow)
            .OrderBy(s => s.ScheduledAt)
            .Select(s => new InterviewScheduleDto(
                s.Id, s.ApplicationId,
                app.JobPost.Title,
                profile!.DisplayName ?? user!.FullName,
                s.ScheduledAt, s.DurationMinutes,
                s.MeetingLink, s.Location, s.Notes, s.Status))
            .FirstOrDefaultAsync(ct);

        return new CandidateInfoDto(
            app.CandidateId,
            profile?.DisplayName ?? user?.FullName ?? "Ứng viên",
            user?.Email ?? "",
            profile?.AvatarUrl,
            profile?.CvUrl,
            profile?.Skills,
            app.Status,
            app.Id,
            app.JobPost.Title,
            upcoming
        );
    }

    // ── Unread count badge ───────────────────────────────────────────────
    public async Task<int> GetUnreadCountAsync(
        string recruiterId, Guid companyId, CancellationToken ct)
    {
        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == companyId)
            .Select(j => j.Id).ToListAsync(ct);

        var appIds = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIds.Contains(a.JobPostId))
            .Select(a => a.Id).ToListAsync(ct);

        return await _db.Messages.AsNoTracking()
            .Where(m => appIds.Contains(m.ApplicationId)
                     && m.SenderId != recruiterId
                     && !m.IsRead)
            .CountAsync(ct);
    }

    // ── Helper: kiểm tra recruiter có quyền với application không ────────
    private async Task VerifyRecruiterAccessAsync(
        string recruiterId, Guid applicationId, CancellationToken ct)
    {
        var ok = await _db.JobApplications.AsNoTracking()
            .AnyAsync(a => a.Id == applicationId
                        && _db.JobPosts
                               .Where(j => j.Id == a.JobPostId)
                               .Any(j => j.Company.OwnerId == recruiterId), ct);
        if (!ok) throw new UnauthorizedAccessException("Bạn không có quyền xem cuộc hội thoại này.");
    }
}

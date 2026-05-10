using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TechList.Application.CandidateMessaging.Interfaces;
using TechList.Application.CandidateMessaging.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.CandidateMessaging;

public sealed class CandidateMessagingService : ICandidateMessagingService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;

    public CandidateMessagingService(AppDbContext db, UserManager<ApplicationUser> users)
    {
        _db    = db;
        _users = users;
    }

    // ── 1. Conversation list (chống N+1: 4 queries thay vì N) ─────────────
    public async Task<List<CandidateConversationDto>> GetConversationsAsync(
        string candidateId, CancellationToken ct)
    {
        // Batch 1: applications của candidate + job + company
        var apps = await _db.JobApplications.AsNoTracking()
            .Where(a => a.CandidateId == candidateId)
            .Include(a => a.JobPost).ThenInclude(j => j.Company)
            .Select(a => new {
                a.Id, a.Status,
                JobTitle    = a.JobPost.Title,
                CompanyName = a.JobPost.Company.Name,
                CompanyLogo = a.JobPost.Company.LogoUrl,
                OwnerId     = a.JobPost.Company.OwnerId,
                JobPostId   = a.JobPost.Id
            })
            .ToListAsync(ct);

        if (!apps.Any()) return new();

        var appIds    = apps.Select(a => a.Id).ToHashSet();
        var ownerIds  = apps.Select(a => a.OwnerId).Distinct().ToList();

        // Batch 2: recruiter info (owner của company)
        var recruiters = await _users.Users.AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToListAsync(ct);
        var recruiterMap  = recruiters.ToDictionary(u => u.Id);

        var profiles = await _db.UserProfiles.AsNoTracking()
            .Where(p => ownerIds.Contains(p.UserId))
            .ToListAsync(ct);
        var profileMap = profiles.ToDictionary(p => p.UserId);

        // Batch 3: last message + unread per application (1 aggregation query)
        var msgStats = await _db.Messages.AsNoTracking()
            .Where(m => appIds.Contains(m.ApplicationId))
            .GroupBy(m => m.ApplicationId)
            .Select(g => new {
                AppId       = g.Key,
                LastContent = g.OrderByDescending(m => m.SentAt).Select(m => m.Content).FirstOrDefault(),
                LastType    = g.OrderByDescending(m => m.SentAt).Select(m => m.Type).FirstOrDefault(),
                LastAt      = (DateTime?)g.Max(m => m.SentAt),
                Unread      = g.Count(m => !m.IsRead && m.SenderId != candidateId)
            })
            .ToListAsync(ct);

        var statMap = msgStats.ToDictionary(s => s.AppId);

        return apps.Select(a => {
            var recruiter = recruiterMap.GetValueOrDefault(a.OwnerId);
            var profile   = profileMap.GetValueOrDefault(a.OwnerId);
            var stat      = statMap.GetValueOrDefault(a.Id);
            return new CandidateConversationDto(
                a.Id, a.JobPostId, a.JobTitle,
                profile?.DisplayName ?? recruiter?.FullName ?? "Nhà tuyển dụng",
                profile?.AvatarUrl,
                a.CompanyName, a.CompanyLogo,
                a.Status,
                stat?.LastContent, stat?.LastType ?? "message",
                stat?.LastAt,
                (stat?.Unread ?? 0) > 0, stat?.Unread ?? 0
            );
        })
        .OrderByDescending(c => c.LastMessageAt ?? DateTime.MinValue)
        .ToList();
    }

    // ── 2. Thread (messages + interview/offer cards) ───────────────────────
    public async Task<List<CandidateMessageDto>> GetThreadAsync(
        string candidateId, Guid applicationId, CancellationToken ct)
    {
        await VerifyAccessAsync(candidateId, applicationId, ct);

        var msgs = await _db.Messages.AsNoTracking()
            .Where(m => m.ApplicationId == applicationId)
            .OrderBy(m => m.SentAt)
            .ToListAsync(ct);

        if (!msgs.Any()) return new();

        // Batch load sender info
        var senderIds  = msgs.Select(m => m.SenderId).Distinct().ToList();
        var senders    = await _users.Users.AsNoTracking()
            .Where(u => senderIds.Contains(u.Id)).ToListAsync(ct);
        var senderMap  = senders.ToDictionary(u => u.Id);

        var senderProfs = await _db.UserProfiles.AsNoTracking()
            .Where(p => senderIds.Contains(p.UserId)).ToListAsync(ct);
        var profMap = senderProfs.ToDictionary(p => p.UserId);

        // Batch load interview cards + offer cards referenced in messages
        var scheduleIds = msgs
            .Where(m => m.Type == "interview_invite" && Guid.TryParse(m.RefId, out _))
            .Select(m => Guid.Parse(m.RefId!)).ToHashSet();

        var offerIds = msgs
            .Where(m => m.Type == "offer" && Guid.TryParse(m.RefId, out _))
            .Select(m => Guid.Parse(m.RefId!)).ToHashSet();

        // Application info for job title
        var appInfo = await _db.JobApplications.AsNoTracking()
            .Where(a => a.Id == applicationId)
            .Include(a => a.JobPost)
            .Select(a => new { a.JobPost.Title, a.JobPost.Company.Name })
            .FirstAsync(ct);

        var schedules = scheduleIds.Any()
            ? await _db.InterviewSchedules.AsNoTracking()
                .Where(s => scheduleIds.Contains(s.Id))
                .ToListAsync(ct)
            : new();

        var offers = offerIds.Any()
            ? await _db.Offers.AsNoTracking()
                .Where(o => offerIds.Contains(o.Id))
                .ToListAsync(ct)
            : new();

        var schedMap = schedules.ToDictionary(s => s.Id.ToString());
        var offerMap = offers.ToDictionary(o => o.Id.ToString());

        return msgs.Select(m => {
            var u  = senderMap.GetValueOrDefault(m.SenderId);
            var p  = profMap.GetValueOrDefault(m.SenderId);

            InterviewCardDto? ivCard = null;
            if (m.Type == "interview_invite" && m.RefId != null && schedMap.TryGetValue(m.RefId, out var sch))
                ivCard = MapInterviewCard(sch, appInfo.Title);

            OfferCardDto? offerCard = null;
            if (m.Type == "offer" && m.RefId != null && offerMap.TryGetValue(m.RefId, out var off))
                offerCard = MapOfferCard(off, appInfo.Title, appInfo.Name);

            return new CandidateMessageDto(
                m.Id, m.ApplicationId, m.SenderId,
                p?.DisplayName ?? u?.FullName ?? "Người dùng",
                p?.AvatarUrl,
                m.SenderId == candidateId,
                m.Content, m.Type, m.RefId, m.IsRead, m.SentAt,
                ivCard, offerCard
            );
        }).ToList();
    }

    // ── 3. Gửi tin nhắn ───────────────────────────────────────────────────
    public async Task<CandidateMessageDto> SendMessageAsync(
        string candidateId, SendCandidateMessageRequest req, CancellationToken ct)
    {
        await VerifyAccessAsync(candidateId, req.ApplicationId, ct);

        var msg = new Message {
            ApplicationId = req.ApplicationId,
            SenderId      = candidateId,
            Content       = req.Content.Trim(),
            Type          = req.Type,
            IsRead        = false,
            SentAt        = DateTime.UtcNow
        };
        _db.Messages.Add(msg);
        await _db.SaveChangesAsync(ct);

        var user    = await _users.FindByIdAsync(candidateId);
        var profile = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == candidateId, ct);

        return new CandidateMessageDto(
            msg.Id, msg.ApplicationId, candidateId,
            profile?.DisplayName ?? user?.FullName ?? "Ứng viên",
            profile?.AvatarUrl,
            true, msg.Content, msg.Type, null, false, msg.SentAt,
            null, null
        );
    }

    // ── 4. Mark read ───────────────────────────────────────────────────────
    public async Task MarkReadAsync(string candidateId, Guid applicationId, CancellationToken ct)
    {
        await _db.Messages
            .Where(m => m.ApplicationId == applicationId
                     && m.SenderId != candidateId
                     && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true), ct);
    }

    // ── 5. Recruiter panel ─────────────────────────────────────────────────
    public async Task<RecruiterPanelDto> GetRecruiterPanelAsync(
        string candidateId, Guid applicationId, CancellationToken ct)
    {
        var app = await _db.JobApplications.AsNoTracking()
            .Include(a => a.JobPost).ThenInclude(j => j.Company)
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.CandidateId == candidateId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        var recruiterId  = app.JobPost.Company.OwnerId;
        var recruiter    = await _users.FindByIdAsync(recruiterId);
        var recruiterProf = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == recruiterId, ct);

        // Batch: upcoming interview + pending offer
        var upcoming = await _db.InterviewSchedules.AsNoTracking()
            .Where(s => s.ApplicationId == applicationId
                     && s.Status == "Scheduled"
                     && s.ScheduledAt > DateTime.UtcNow)
            .OrderBy(s => s.ScheduledAt)
            .FirstOrDefaultAsync(ct);

        var pendingOffer = await _db.Offers.AsNoTracking()
            .Where(o => o.ApplicationId == applicationId && o.Status == "Pending")
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);

        return new RecruiterPanelDto(
            recruiterId,
            recruiterProf?.DisplayName ?? recruiter?.FullName ?? "Nhà tuyển dụng",
            recruiterProf?.AvatarUrl,
            recruiter?.Email ?? "",
            app.JobPost.Company.Name,
            app.JobPost.Company.LogoUrl,
            app.JobPost.Company.Website,
            app.Status,
            app.JobPost.Title,
            upcoming is null ? null : MapInterviewCard(upcoming, app.JobPost.Title),
            pendingOffer is null ? null : MapOfferCard(pendingOffer, app.JobPost.Title, app.JobPost.Company.Name)
        );
    }

    // ── 6. Unread count ────────────────────────────────────────────────────
    public async Task<int> GetUnreadCountAsync(string candidateId, CancellationToken ct)
    {
        var appIds = await _db.JobApplications.AsNoTracking()
            .Where(a => a.CandidateId == candidateId)
            .Select(a => a.Id).ToListAsync(ct);

        return await _db.Messages.AsNoTracking()
            .Where(m => appIds.Contains(m.ApplicationId)
                     && m.SenderId != candidateId
                     && !m.IsRead)
            .CountAsync(ct);
    }

    // ── 7. Lấy tất cả lịch phỏng vấn của candidate ────────────────────────
    public async Task<List<CandidateInterviewListDto>> GetAllInterviewsAsync(string candidateId, CancellationToken ct)
    {
        var appIds = await _db.JobApplications.AsNoTracking()
            .Where(a => a.CandidateId == candidateId)
            .Select(a => a.Id).ToListAsync(ct);

        var schedules = await _db.InterviewSchedules.AsNoTracking()
            .Where(s => appIds.Contains(s.ApplicationId) && s.Status != "Cancelled")
            .Include(s => s.Application).ThenInclude(a => a.JobPost).ThenInclude(j => j.Company)
            .OrderBy(s => s.ScheduledAt)
            .ToListAsync(ct);

        return schedules.Select(s => new CandidateInterviewListDto(
            s.Id,
            s.Application.JobPost.Title,
            s.Application.JobPost.Company.Name,
            s.Application.JobPost.Company.LogoUrl,
            s.ScheduledAt,
            s.DurationMinutes,
            s.MeetingLink,
            s.Location,
            s.Status,
            s.CandidateResponse
        )).ToList();
    }

    // ── 8. Phản hồi lời mời phỏng vấn ─────────────────────────────────────
    public async Task<InterviewCardDto> RespondToInterviewAsync(
        string candidateId, Guid scheduleId, InterviewResponseRequest req, CancellationToken ct)
    {
        var valid = new[] { "Accepted", "Declined" };
        if (!valid.Contains(req.Response))
            throw new InvalidOperationException("Phản hồi không hợp lệ.");

        var schedule = await _db.InterviewSchedules.AsTracking()
            .Include(s => s.Application).ThenInclude(a => a.JobPost)
            .FirstOrDefaultAsync(s => s.Id == scheduleId
                && s.Application.CandidateId == candidateId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy lịch phỏng vấn.");

        if (schedule.CandidateResponse != "Pending")
            throw new InvalidOperationException("Bạn đã phản hồi lịch này rồi.");

        schedule.CandidateResponse = req.Response;
        schedule.DeclineReason     = req.DeclineReason;
        schedule.RespondedAt       = DateTime.UtcNow;

        // Tự động gửi system message xác nhận
        var content = req.Response == "Accepted"
            ? $"✅ Bạn đã xác nhận tham gia phỏng vấn vào {schedule.ScheduledAt:dd/MM/yyyy HH:mm}."
            : $"❌ Bạn đã từ chối lịch phỏng vấn.{(req.DeclineReason != null ? $" Lý do: {req.DeclineReason}" : "")}";

        _db.Messages.Add(new Message {
            ApplicationId = schedule.ApplicationId,
            SenderId      = candidateId,
            Content       = content,
            Type          = "system_notify",
            IsRead        = false,
            SentAt        = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return MapInterviewCard(schedule, schedule.Application.JobPost.Title);
    }

    // ── 8. Phản hồi offer ─────────────────────────────────────────────────
    public async Task<OfferCardDto> RespondToOfferAsync(
        string candidateId, Guid offerId, OfferResponseRequest req, CancellationToken ct)
    {
        var valid = new[] { "Accepted", "Declined", "Negotiating" };
        if (!valid.Contains(req.Response))
            throw new InvalidOperationException("Phản hồi không hợp lệ.");

        var offer = await _db.Offers.AsTracking()
            .Include(o => o.Application).ThenInclude(a => a.JobPost).ThenInclude(j => j.Company)
            .FirstOrDefaultAsync(o => o.Id == offerId
                && o.Application.CandidateId == candidateId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy offer.");

        if (offer.Status != "Pending")
            throw new InvalidOperationException("Offer này đã được phản hồi rồi.");

        offer.Status        = req.Response;
        offer.DeclineReason = req.DeclineReason;
        offer.RespondedAt   = DateTime.UtcNow;

        var statusLabel = req.Response switch {
            "Accepted"    => "chấp nhận",
            "Declined"    => "từ chối",
            "Negotiating" => "yêu cầu thương lượng",
            _             => req.Response
        };

        var emoji = req.Response switch {
            "Accepted"    => "🎉",
            "Declined"    => "❌",
            "Negotiating" => "💬",
            _             => "📋"
        };

        _db.Messages.Add(new Message {
            ApplicationId = offer.ApplicationId,
            SenderId      = candidateId,
            Content       = $"{emoji} Bạn đã {statusLabel} offer cho vị trí {offer.Application.JobPost.Title}.",
            Type          = "system_notify",
            IsRead        = false,
            SentAt        = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return MapOfferCard(offer, offer.Application.JobPost.Title, offer.Application.JobPost.Company.Name);
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private async Task VerifyAccessAsync(string candidateId, Guid applicationId, CancellationToken ct)
    {
        var ok = await _db.JobApplications.AsNoTracking()
            .AnyAsync(a => a.Id == applicationId && a.CandidateId == candidateId, ct);
        if (!ok) throw new UnauthorizedAccessException("Bạn không có quyền xem cuộc hội thoại này.");
    }

    private static InterviewCardDto MapInterviewCard(InterviewSchedule s, string jobTitle) =>
        new(s.Id, jobTitle, s.ScheduledAt, s.DurationMinutes,
            s.MeetingLink, s.Location, s.Notes,
            s.Status, s.CandidateResponse, s.DeclineReason);

    private static OfferCardDto MapOfferCard(Offer o, string jobTitle, string companyName) =>
        new(o.Id, jobTitle, companyName, o.Salary, o.StartDate, o.ResponseDeadline,
            o.Notes, o.Status, o.DeclineReason);
}

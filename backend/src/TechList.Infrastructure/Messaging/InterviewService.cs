using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TechList.Application.Email;
using TechList.Application.Messaging.Interfaces;
using TechList.Application.Messaging.Models;
using TechList.Domain.Entities;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Messaging;

public sealed class InterviewService : IInterviewService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _emailService;
    private readonly ILogger<InterviewService> _logger;

    public InterviewService(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        IEmailService emailService,
        ILogger<InterviewService> logger)
    {
        _db = db;
        _userManager = userManager;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<InterviewScheduleDto> ScheduleAsync(
        string recruiterId, ScheduleInterviewRequest request, CancellationToken ct)
    {
        var app = await _db.JobApplications.AsNoTracking()
            .Include(a => a.JobPost).ThenInclude(j => j.Company)
            .FirstOrDefaultAsync(a => a.Id == request.ApplicationId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        if (app.JobPost.Company.OwnerId != recruiterId)
            throw new UnauthorizedAccessException("Bạn không có quyền lên lịch cho đơn này.");

        var schedule = new InterviewSchedule
        {
            Id             = Guid.NewGuid(),
            ApplicationId  = request.ApplicationId,
            ScheduledAt    = request.ScheduledAt.ToUniversalTime(),
            DurationMinutes = request.DurationMinutes,
            MeetingLink    = request.MeetingLink,
            Location       = request.Location,
            Notes          = request.Notes,
            Status         = "Scheduled",
            CreatedAt      = DateTime.UtcNow
        };

        _db.InterviewSchedules.Add(schedule);

        // Cập nhật trạng thái đơn → Interview
        var appTracked = await _db.JobApplications.FirstAsync(a => a.Id == request.ApplicationId, ct);
        appTracked.Status    = "Interview";
        appTracked.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        var candidate = await _userManager.FindByIdAsync(app.CandidateId);
        var profile   = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == app.CandidateId, ct);

        var dto = new InterviewScheduleDto(
            schedule.Id, schedule.ApplicationId,
            app.JobPost.Title,
            profile?.DisplayName ?? candidate?.FullName ?? "Ứng viên",
            schedule.ScheduledAt, schedule.DurationMinutes,
            schedule.MeetingLink, schedule.Location, schedule.Notes, schedule.Status
        );

        if (!string.IsNullOrEmpty(candidate?.Email))
        {
            try
            {
                await _emailService.SendInterviewScheduledEmailAsync(
                    toEmail: candidate.Email,
                    candidateName: dto.CandidateName,
                    jobTitle: app.JobPost.Title,
                    companyName: app.JobPost.Company.Name,
                    scheduledAt: schedule.ScheduledAt,
                    durationMinutes: schedule.DurationMinutes,
                    meetingLink: schedule.MeetingLink,
                    location: schedule.Location,
                    notes: schedule.Notes,
                    ct: ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể gửi email lịch phỏng vấn cho ứng viên {Email}", candidate.Email);
            }
        }

        return dto;
    }

    public async Task<List<InterviewScheduleDto>> GetUpcomingAsync(
        string recruiterId, Guid companyId, CancellationToken ct)
    {
        // Batch: lấy tất cả job IDs → application IDs → schedules (3 queries, không N+1)
        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == companyId)
            .Select(j => j.Id).ToListAsync(ct);

        var appInfos = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIds.Contains(a.JobPostId))
            .Select(a => new { a.Id, a.CandidateId, a.JobPostId })
            .ToListAsync(ct);

        if (!appInfos.Any()) return new();

        var appIds      = appInfos.Select(a => a.Id).ToHashSet();
        var appMap      = appInfos.ToDictionary(a => a.Id);
        var jobTitles   = await _db.JobPosts.AsNoTracking()
            .Where(j => jobIds.Contains(j.Id))
            .Select(j => new { j.Id, j.Title })
            .ToListAsync(ct);
        var jobTitleMap = jobTitles.ToDictionary(j => j.Id, j => j.Title);

        var schedules = await _db.InterviewSchedules.AsNoTracking()
            .Where(s => appIds.Contains(s.ApplicationId)
                     && s.Status == "Scheduled"
                     && s.ScheduledAt >= DateTime.UtcNow.AddHours(-1))
            .OrderBy(s => s.ScheduledAt)
            .Take(20)
            .ToListAsync(ct);

        if (!schedules.Any()) return new();

        var candidateIds = appInfos
            .Where(a => schedules.Any(s => s.ApplicationId == a.Id))
            .Select(a => a.CandidateId).Distinct().ToList();

        var users    = await _userManager.Users.AsNoTracking()
            .Where(u => candidateIds.Contains(u.Id)).ToListAsync(ct);
        var profiles = await _db.UserProfiles.AsNoTracking()
            .Where(p => candidateIds.Contains(p.UserId)).ToListAsync(ct);

        var userMap    = users.ToDictionary(u => u.Id);
        var profileMap = profiles.ToDictionary(p => p.UserId);

        return schedules.Select(s =>
        {
            var app = appMap.GetValueOrDefault(s.ApplicationId);
            var u   = app is null ? null : userMap.GetValueOrDefault(app.CandidateId);
            var p   = app is null ? null : profileMap.GetValueOrDefault(app.CandidateId);
            return new InterviewScheduleDto(
                s.Id, s.ApplicationId,
                app is null ? "" : jobTitleMap.GetValueOrDefault(app.JobPostId, ""),
                p?.DisplayName ?? u?.FullName ?? "Ứng viên",
                s.ScheduledAt, s.DurationMinutes,
                s.MeetingLink, s.Location, s.Notes, s.Status
            );
        }).ToList();
    }

    public async Task<List<InterviewScheduleDto>> GetAllByCompanyAsync(
        string recruiterId, Guid companyId, CancellationToken ct)
    {
        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == companyId)
            .Select(j => j.Id).ToListAsync(ct);

        var appInfos = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIds.Contains(a.JobPostId))
            .Select(a => new { a.Id, a.CandidateId, a.JobPostId })
            .ToListAsync(ct);

        if (!appInfos.Any()) return new();

        var appIds      = appInfos.Select(a => a.Id).ToHashSet();
        var appMap      = appInfos.ToDictionary(a => a.Id);
        var jobTitleMap = (await _db.JobPosts.AsNoTracking()
            .Where(j => jobIds.Contains(j.Id))
            .Select(j => new { j.Id, j.Title })
            .ToListAsync(ct)).ToDictionary(j => j.Id, j => j.Title);

        var schedules = await _db.InterviewSchedules.AsNoTracking()
            .Where(s => appIds.Contains(s.ApplicationId) && s.Status != "Cancelled")
            .OrderBy(s => s.ScheduledAt)
            .ToListAsync(ct);

        if (!schedules.Any()) return new();

        var candidateIds = appInfos
            .Where(a => schedules.Any(s => s.ApplicationId == a.Id))
            .Select(a => a.CandidateId).Distinct().ToList();

        var users      = await _userManager.Users.AsNoTracking()
            .Where(u => candidateIds.Contains(u.Id)).ToListAsync(ct);
        var profiles   = await _db.UserProfiles.AsNoTracking()
            .Where(p => candidateIds.Contains(p.UserId)).ToListAsync(ct);
        var userMap    = users.ToDictionary(u => u.Id);
        var profileMap = profiles.ToDictionary(p => p.UserId);

        return schedules.Select(s =>
        {
            var app = appMap.GetValueOrDefault(s.ApplicationId);
            var u   = app is null ? null : userMap.GetValueOrDefault(app.CandidateId);
            var p   = app is null ? null : profileMap.GetValueOrDefault(app.CandidateId);
            return new InterviewScheduleDto(
                s.Id, s.ApplicationId,
                app is null ? "" : jobTitleMap.GetValueOrDefault(app.JobPostId, ""),
                p?.DisplayName ?? u?.FullName ?? "Ứng viên",
                s.ScheduledAt, s.DurationMinutes,
                s.MeetingLink, s.Location, s.Notes, s.Status
            );
        }).ToList();
    }

    public async Task<InterviewScheduleDto> CancelAsync(
        string recruiterId, Guid scheduleId, CancellationToken ct)
    {
        var s = await _db.InterviewSchedules.AsTracking()
            .Include(x => x.Application).ThenInclude(a => a.JobPost).ThenInclude(j => j.Company)
            .FirstOrDefaultAsync(x => x.Id == scheduleId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy lịch phỏng vấn.");

        if (s.Application.JobPost.Company.OwnerId != recruiterId)
            throw new UnauthorizedAccessException("Không có quyền hủy lịch này.");

        s.Status = "Cancelled";
        await _db.SaveChangesAsync(ct);

        return new InterviewScheduleDto(
            s.Id, s.ApplicationId,
            s.Application.JobPost.Title, "",
            s.ScheduledAt, s.DurationMinutes,
            s.MeetingLink, s.Location, s.Notes, s.Status
        );
    }
}

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TechList.Application.Applications.Interfaces;
using TechList.Application.Applications.Models;
using TechList.Application.Email;
using TechList.Application.Notifications.Interfaces;
using TechList.Domain.Entities;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Applications;

public sealed class JobApplicationService : IJobApplicationService
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _emailService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<JobApplicationService> _logger;

    public JobApplicationService(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        IEmailService emailService,
        INotificationService notificationService,
        ILogger<JobApplicationService> logger)
    {
        _db = db;
        _userManager = userManager;
        _emailService = emailService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<JobApplicationDto> ApplyAsync(string candidateId, CreateApplicationRequest request, CancellationToken ct)
    {
        var job = await _db.JobPosts
            .Include(j => j.Company)
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == request.JobPostId && j.IsActive && j.IsApproved, ct)
            ?? throw new InvalidOperationException("Không tìm thấy tin tuyển dụng.");

        var alreadyApplied = await _db.JobApplications
            .AnyAsync(a => a.JobPostId == request.JobPostId && a.CandidateId == candidateId, ct);
        if (alreadyApplied)
            throw new InvalidOperationException("Bạn đã nộp đơn cho vị trí này rồi.");

        var application = new JobApplication
        {
            Id = Guid.NewGuid(),
            JobPostId = request.JobPostId,
            CandidateId = candidateId,
            Status = "Applied",
            CoverLetter = request.CoverLetter,
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.JobApplications.Add(application);
        await _db.SaveChangesAsync(ct);

        try
        {
            await _notificationService.CreateAsync(
                userId: job.Company.OwnerId,
                title: "Đơn ứng tuyển mới",
                message: $"Có ứng viên mới nộp đơn cho vị trí {job.Title}.",
                type: "NewApplication",
                jobPostId: job.Id,
                jobTitle: job.Title,
                ct: ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không thể tạo thông báo cho recruiter khi có đơn ứng tuyển mới.");
        }

        return await BuildDto(application.Id, ct);
    }

    public async Task<List<JobApplicationDto>> GetMyApplicationsAsync(string candidateId, CancellationToken ct)
    {
        var ids = await _db.JobApplications
            .Where(a => a.CandidateId == candidateId)
            .OrderByDescending(a => a.AppliedAt)
            .Select(a => a.Id)
            .ToListAsync(ct);

        var result = new List<JobApplicationDto>();
        foreach (var id in ids)
            result.Add(await BuildDto(id, ct));

        return result;
    }

    public async Task<List<JobApplicationDto>> GetByJobAsync(string recruiterId, Guid jobPostId, CancellationToken ct)
    {
        var job = await _db.JobPosts
            .Include(j => j.Company)
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == jobPostId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy tin tuyển dụng.");

        if (job.Company.OwnerId != recruiterId)
            throw new UnauthorizedAccessException("Bạn không có quyền xem đơn ứng tuyển này.");

        var ids = await _db.JobApplications
            .Where(a => a.JobPostId == jobPostId)
            .OrderByDescending(a => a.AppliedAt)
            .Select(a => a.Id)
            .ToListAsync(ct);

        var result = new List<JobApplicationDto>();
        foreach (var id in ids)
            result.Add(await BuildDto(id, ct));

        return result;
    }

    public async Task<List<JobApplicationDto>> GetByCompanyAsync(string recruiterId, Guid companyId, CancellationToken ct)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy công ty.");

        if (company.OwnerId != recruiterId)
            throw new UnauthorizedAccessException("Bạn không có quyền xem dữ liệu công ty này.");

        var jobIds = await _db.JobPosts
            .Where(j => j.CompanyId == companyId)
            .Select(j => j.Id)
            .ToListAsync(ct);

        var apps = await _db.JobApplications
            .Include(a => a.JobPost)
            .Where(a => jobIds.Contains(a.JobPostId))
            .OrderByDescending(a => a.AppliedAt)
            .AsNoTracking()
            .ToListAsync(ct);

        if (apps.Count == 0) return [];

        return await BuildBatchDto(apps, ct);
    }

    public async Task<JobApplicationDto> UpdateStatusAsync(string recruiterId, Guid applicationId, string newStatus, CancellationToken ct)
    {
        var validStatuses = new[] { "Applied", "Screening", "Interview", "Offered", "Rejected", "Hired" };
        if (!validStatuses.Contains(newStatus))
            throw new InvalidOperationException($"Trạng thái không hợp lệ: {newStatus}");

        var application = await _db.JobApplications
            .Include(a => a.JobPost).ThenInclude(j => j.Company)
            .AsTracking()
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        if (application.JobPost.Company.OwnerId != recruiterId)
            throw new UnauthorizedAccessException("Bạn không có quyền cập nhật đơn này.");

        var oldStatus = application.Status;
        application.Status = newStatus;
        application.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var dto = await BuildDto(application.Id, ct);

        try
        {
            await _notificationService.CreateAsync(
                userId: application.CandidateId,
                title: GetStatusTitle(newStatus),
                message: $"Trạng thái đơn ứng tuyển vị trí {application.JobPost.Title} đã được cập nhật.",
                type: newStatus,
                jobPostId: application.JobPost.Id,
                jobTitle: application.JobPost.Title,
                ct: ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không thể tạo thông báo in-app cho ứng viên {Id}", application.CandidateId);
        }

        if (!string.IsNullOrEmpty(dto.CandidateEmail) && newStatus != oldStatus)
        {
            var toEmail       = dto.CandidateEmail;
            var candidateName = dto.CandidateName;
            var jobTitle      = dto.JobTitle;
            var companyName   = application.JobPost.Company.Name;
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendApplicationStatusEmailAsync(
                        toEmail, candidateName, jobTitle, companyName, newStatus);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không thể gửi email thông báo cho ứng viên {Email}", toEmail);
                }
            });
        }

        return dto;
    }

    public async Task<JobApplicationDto> GetByIdAsync(string userId, Guid applicationId, CancellationToken ct)
    {
        var application = await _db.JobApplications
            .Include(a => a.JobPost).ThenInclude(j => j.Company)
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        var isOwner = application.CandidateId == userId;
        var isRecruiter = application.JobPost.Company.OwnerId == userId;
        if (!isOwner && !isRecruiter)
            throw new UnauthorizedAccessException("Bạn không có quyền xem đơn này.");

        return await BuildDto(applicationId, ct);
    }

    public async Task<bool> CheckAppliedAsync(string candidateId, Guid jobPostId, CancellationToken ct)
    {
        return await _db.JobApplications
            .AnyAsync(a => a.JobPostId == jobPostId && a.CandidateId == candidateId, ct);
    }

    public async Task WithdrawAsync(string candidateId, Guid applicationId, CancellationToken ct)
    {
        var application = await _db.JobApplications
            .AsTracking()
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy đơn ứng tuyển.");

        if (application.CandidateId != candidateId)
            throw new UnauthorizedAccessException("Bạn không có quyền rút đơn này.");

        var withdrawable = new[] { "Applied", "Screening" };
        if (!withdrawable.Contains(application.Status))
            throw new InvalidOperationException("Chỉ có thể rút đơn khi trạng thái là Đã nộp hoặc Đang xem xét.");

        _db.JobApplications.Remove(application);
        await _db.SaveChangesAsync(ct);
    }

    private static string GetStage(string status) => status switch
    {
        "Applied" or "Screening"   => "apply",
        "Interview"                => "interview",
        "Offered"                  => "offer",
        "Hired" or "Rejected"      => "done",
        _                          => status
    };

    private static string GetStatusTitle(string status) => status switch
    {
        "Screening" => "Hồ sơ đang được xem xét",
        "Interview" => "Bạn được mời phỏng vấn",
        "Offered"   => "Chúc mừng! Bạn nhận được offer",
        "Hired"     => "Chúc mừng! Bạn đã được tuyển dụng",
        "Rejected"  => "Đơn ứng tuyển đã bị từ chối",
        _           => "Cập nhật trạng thái ứng tuyển"
    };

    private async Task<JobApplicationDto> BuildDto(Guid applicationId, CancellationToken ct)
    {
        var app = await _db.JobApplications
            .Include(a => a.JobPost)
            .AsNoTracking()
            .FirstAsync(a => a.Id == applicationId, ct);

        var user    = await _userManager.FindByIdAsync(app.CandidateId);
        var profile = await _db.UserProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == app.CandidateId, ct);

        return MapToDto(app, user, profile);
    }

    private async Task<List<JobApplicationDto>> BuildBatchDto(
        List<JobApplication> apps, CancellationToken ct)
    {
        var candidateIds = apps.Select(a => a.CandidateId).Distinct().ToList();

        var users = await _userManager.Users
            .Where(u => candidateIds.Contains(u.Id))
            .ToListAsync(ct);

        var profiles = await _db.UserProfiles
            .Where(p => candidateIds.Contains(p.UserId))
            .AsNoTracking()
            .ToListAsync(ct);

        var userDict    = users.ToDictionary(u => u.Id);
        var profileDict = profiles.ToDictionary(p => p.UserId);

        return apps.Select(app =>
        {
            userDict.TryGetValue(app.CandidateId, out var user);
            profileDict.TryGetValue(app.CandidateId, out var profile);
            return MapToDto(app, user, profile);
        }).ToList();
    }

    private static JobApplicationDto MapToDto(
        JobApplication app, ApplicationUser? user, UserProfile? profile) =>
        new(
            app.Id, app.JobPostId, app.JobPost.Title,
            app.CandidateId,
            profile?.DisplayName ?? user?.FullName ?? user?.Email ?? "Ứng viên",
            user?.Email ?? "",
            profile?.AvatarUrl, profile?.CvUrl, profile?.Skills,
            profile?.Experience, profile?.Education,
            app.Status, app.CoverLetter, app.AppliedAt, app.UpdatedAt
        );
}

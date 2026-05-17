using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using TechList.Application.Recruiters.Interfaces;
using TechList.Application.Recruiters.Models;
using TechList.Infrastructure.Persistence;

namespace TechList.Infrastructure.Recruiters;

public sealed class RecruiterStatisticsService : IRecruiterStatisticsService
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private static string CK(string prefix, RecruiterStatsQuery q)
        => $"rec_{prefix}_{q.CompanyId}_{q.StartDate:yyyyMMdd}_{q.EndDate:yyyyMMdd}";

    private static string CKSimple(string prefix, Guid companyId)
        => $"rec_{prefix}_{companyId}";

    public RecruiterStatisticsService(AppDbContext db, IMemoryCache cache)
    {
        _db    = db;
        _cache = cache;
    }

    // ── 1. Overview Cards ─────────────────────────────────────────────────
    public async Task<RecruiterOverviewDto> GetOverviewAsync(RecruiterStatsQuery query, CancellationToken ct)
    {
        var cacheKey = CK("overview", query);
        if (_cache.TryGetValue(cacheKey, out RecruiterOverviewDto? cached) && cached is not null)
            return cached;

        var startUtc = query.StartDate.ToUniversalTime();
        var endUtc   = query.EndDate.ToUniversalTime();
        var span     = endUtc - startUtc;
        var prevStart = startUtc - span;
        var prevEnd   = startUtc;

        // Lấy tất cả job IDs của công ty trong 1 query
        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == query.CompanyId)
            .Select(j => new { j.Id, j.IsActive, j.IsApproved, j.ExpiresAt, j.CreatedAt })
            .ToListAsync(ct);

        var allJobIds   = jobIds.Select(j => j.Id).ToHashSet();
        int activeJobs  = jobIds.Count(j => j.IsActive && j.IsApproved && j.ExpiresAt > DateTime.UtcNow);
        int currentJobs = jobIds.Count(j => j.CreatedAt >= startUtc && j.CreatedAt <= endUtc);
        int prevJobs    = jobIds.Count(j => j.CreatedAt >= prevStart && j.CreatedAt < prevEnd);

        // Lấy tất cả applications của công ty trong 1 query (tránh N+1)
        var apps = await _db.JobApplications.AsNoTracking()
            .Where(a => allJobIds.Contains(a.JobPostId))
            .Select(a => new { a.Status, a.AppliedAt })
            .ToListAsync(ct);

        int totalApps   = apps.Count;
        int currentApps = apps.Count(a => a.AppliedAt >= startUtc && a.AppliedAt <= endUtc);
        int prevApps    = apps.Count(a => a.AppliedAt >= prevStart && a.AppliedAt < prevEnd);
        int interviews  = apps.Count(a => a.Status == "Interview");
        int prevInterviews = 0; // computed from prev period applications
        int offered     = apps.Count(a => a.Status == "Offered");

        // Previous period interview count (from apps in prev period)
        prevInterviews = await _db.JobApplications.AsNoTracking()
            .Where(a => allJobIds.Contains(a.JobPostId)
                     && a.AppliedAt >= prevStart && a.AppliedAt < prevEnd
                     && a.Status == "Interview")
            .CountAsync(ct);

        static double Pct(int cur, int prev)
            => prev == 0 ? (cur > 0 ? 100.0 : 0.0) : Math.Round((cur - prev) * 100.0 / prev, 1);

        var result = new RecruiterOverviewDto(
            totalApps, currentApps, prevApps, Pct(currentApps, prevApps),
            activeJobs, currentJobs, prevJobs, Pct(currentJobs, prevJobs),
            interviews, prevInterviews, Pct(interviews, prevInterviews),
            offered
        );

        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    // ── 2. Status Distribution (Donut Chart) ─────────────────────────────
    public async Task<List<AppStatusDistDto>> GetStatusDistributionAsync(Guid companyId, CancellationToken ct)
    {
        var cacheKey = CKSimple("status_dist", companyId);
        if (_cache.TryGetValue(cacheKey, out List<AppStatusDistDto>? cached) && cached is not null)
            return cached;

        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == companyId)
            .Select(j => j.Id)
            .ToListAsync(ct);

        var groups = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIds.Contains(a.JobPostId))
            .GroupBy(a => a.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        int total = groups.Sum(g => g.Count);

        var statusLabels = new Dictionary<string, string>
        {
            ["Applied"]   = "Mới nộp",
            ["Screening"] = "Sàng lọc",
            ["Interview"] = "Phỏng vấn",
            ["Offered"]   = "Đề nghị",
            ["Hired"]     = "Đã tuyển",
            ["Rejected"]  = "Từ chối"
        };

        var result = groups
            .Select(g => new AppStatusDistDto(
                g.Status,
                statusLabels.GetValueOrDefault(g.Status, g.Status),
                g.Count,
                total > 0 ? Math.Round(g.Count * 100.0 / total, 1) : 0))
            .OrderByDescending(x => x.Count)
            .ToList();

        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    // ── 3. Application Trend (Line Chart) ────────────────────────────────
    public async Task<List<AppTrendPointDto>> GetApplicationTrendAsync(RecruiterStatsQuery query, CancellationToken ct)
    {
        var cacheKey = CK("trend", query);
        if (_cache.TryGetValue(cacheKey, out List<AppTrendPointDto>? cached) && cached is not null)
            return cached;

        var startUtc = query.StartDate.ToUniversalTime();
        var endUtc   = query.EndDate.ToUniversalTime();

        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == query.CompanyId)
            .Select(j => j.Id)
            .ToListAsync(ct);

        var dates = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIds.Contains(a.JobPostId)
                     && a.AppliedAt >= startUtc && a.AppliedAt <= endUtc)
            .Select(a => a.AppliedAt)
            .ToListAsync(ct);

        int totalDays = (int)(endUtc - startUtc).TotalDays + 1;
        List<AppTrendPointDto> points;

        if (totalDays <= 31)
        {
            // Group by day
            points = Enumerable.Range(0, totalDays)
                .Select(i =>
                {
                    var day = startUtc.AddDays(i).Date;
                    return new AppTrendPointDto(
                        day.ToString("dd/MM"),
                        dates.Count(d => d.Date == day));
                })
                .ToList();
        }
        else if (totalDays <= 91)
        {
            // Group by week
            int weeks = (int)Math.Ceiling(totalDays / 7.0);
            points = Enumerable.Range(0, weeks)
                .Select(i =>
                {
                    var ws = startUtc.AddDays(i * 7);
                    var we = ws.AddDays(7);
                    return new AppTrendPointDto(
                        $"T{i + 1} ({ws:dd/MM})",
                        dates.Count(d => d >= ws && d < we));
                })
                .ToList();
        }
        else
        {
            // Group by month
            points = Enumerable.Range(0, 12)
                .Select(i =>
                {
                    var m = new DateTime(startUtc.Year, startUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(i);
                    if (m > endUtc) return null;
                    return new AppTrendPointDto(
                        m.ToString("MM/yyyy"),
                        dates.Count(d => d.Year == m.Year && d.Month == m.Month));
                })
                .Where(p => p is not null)
                .Cast<AppTrendPointDto>()
                .ToList();
        }

        _cache.Set(cacheKey, points, CacheTtl);
        return points;
    }

    // ── 4. Hot Skills from Candidates (Bar Chart) ────────────────────────
    public async Task<List<CandSkillStatDto>> GetHotSkillsAsync(Guid companyId, CancellationToken ct)
    {
        var cacheKey = CKSimple("hot_skills", companyId);
        if (_cache.TryGetValue(cacheKey, out List<CandSkillStatDto>? cached) && cached is not null)
            return cached;

        var jobIds = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == companyId)
            .Select(j => j.Id)
            .ToListAsync(ct);

        // Lấy candidateIds của ứng viên đã apply cho công ty này
        var candidateIds = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIds.Contains(a.JobPostId))
            .Select(a => a.CandidateId)
            .Distinct()
            .ToListAsync(ct);

        // Lấy skills từ profiles của các ứng viên này (1 query)
        var skillStrings = await _db.UserProfiles.AsNoTracking()
            .Where(p => candidateIds.Contains(p.UserId) && p.Skills != null && p.Skills != "")
            .Select(p => p.Skills!)
            .ToListAsync(ct);

        var allSkills = skillStrings
            .SelectMany(s =>
            {
                try
                {
                    var arr = JsonSerializer.Deserialize<JsonElement[]>(s);
                    if (arr is null) return [];
                    return arr
                        .Select(el => el.TryGetProperty("name", out var n) ? n.GetString() : null)
                        .Where(n => !string.IsNullOrWhiteSpace(n))
                        .Select(n => n!);
                }
                catch { return []; }
            })
            .ToList();

        int total = allSkills.Count;

        List<CandSkillStatDto> result;

        if (total > 0)
        {
            result = allSkills
                .GroupBy(s => s, StringComparer.OrdinalIgnoreCase)
                .Select(g => new CandSkillStatDto(g.Key, g.Count(), total > 0 ? Math.Round(g.Count() * 100.0 / total, 1) : 0))
                .OrderByDescending(x => x.Count)
                .Take(8)
                .ToList();
        }
        else
        {
            // Phân tích từ job requirements nếu không có skills ứng viên
            var requirements = await _db.JobPosts.AsNoTracking()
                .Where(j => jobIds.Contains(j.Id))
                .Select(j => j.Requirements)
                .ToListAsync(ct);

            var keywords = new[] { "C#", ".NET", "Java", "Python", "JavaScript", "TypeScript",
                "React", "Vue.js", "Angular", "Node.js", "SQL", "Docker", "Git", "AWS", "Azure" };

            var counts = keywords
                .Select(k => new CandSkillStatDto(k,
                    requirements.Count(r => r.Contains(k, StringComparison.OrdinalIgnoreCase)), 0))
                .Where(x => x.Count > 0)
                .OrderByDescending(x => x.Count)
                .Take(8)
                .ToList();

            result = counts.Any() ? counts : keywords.Take(5)
                .Select((k, i) => new CandSkillStatDto(k, 5 - i, 0)).ToList();
        }

        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    // ── 5. Job Performance Table ──────────────────────────────────────────
    public async Task<List<JobPerformanceDto>> GetJobPerformanceAsync(RecruiterStatsQuery query, CancellationToken ct)
    {
        var cacheKey = CK("job_perf", query);
        if (_cache.TryGetValue(cacheKey, out List<JobPerformanceDto>? cached) && cached is not null)
            return cached;

        var startUtc = query.StartDate.ToUniversalTime();
        var endUtc   = query.EndDate.ToUniversalTime();

        // Lấy jobs trong kỳ (hoặc tất cả nếu không có)
        var jobs = await _db.JobPosts.AsNoTracking()
            .Where(j => j.CompanyId == query.CompanyId)
            .OrderByDescending(j => j.CreatedAt)
            .Take(20)
            .Select(j => new { j.Id, j.Title, j.JobType, j.IsActive, j.IsApproved, j.ExpiresAt })
            .ToListAsync(ct);

        if (!jobs.Any()) return new List<JobPerformanceDto>();

        var jobIdList = jobs.Select(j => j.Id).ToList();

        // Lấy tất cả applications trong 1 query rồi group in-memory (tránh N+1)
        var apps = await _db.JobApplications.AsNoTracking()
            .Where(a => jobIdList.Contains(a.JobPostId))
            .Select(a => new { a.JobPostId, a.Status })
            .ToListAsync(ct);

        var appsByJob = apps.GroupBy(a => a.JobPostId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = jobs.Select(j =>
        {
            var jApps = appsByJob.GetValueOrDefault(j.Id) ?? new();
            return new JobPerformanceDto(
                j.Id,
                j.Title,
                j.JobType,
                j.IsActive,
                j.IsApproved,
                j.ExpiresAt,
                jApps.Count,
                jApps.Count(a => a.Status == "Screening"),
                jApps.Count(a => a.Status == "Interview"),
                jApps.Count(a => a.Status == "Offered"),
                jApps.Count(a => a.Status == "Rejected")
            );
        })
        .OrderByDescending(j => j.TotalApplications)
        .ToList();

        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }
}

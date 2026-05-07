namespace TechList.Application.Recruiters.Models;

// ── Overview cards ──────────────────────────────────────────
public record RecruiterOverviewDto(
    int TotalApplications,
    int CurrentPeriodApplications,
    int PrevPeriodApplications,
    double ApplicationGrowthPct,

    int ActiveJobs,
    int CurrentPeriodJobs,
    int PrevPeriodJobs,
    double JobGrowthPct,

    int InterviewCount,
    int PrevInterviewCount,
    double InterviewGrowthPct,

    int OfferedCount
);

// ── Donut: application status distribution ─────────────────
public record AppStatusDistDto(
    string Status,
    string Label,
    int Count,
    double Percentage
);

// ── Line chart: applications over time ─────────────────────
public record AppTrendPointDto(
    string Label,
    int Count
);

// ── Bar chart: hot skills from candidates ──────────────────
public record CandSkillStatDto(
    string Skill,
    int Count,
    double Percentage
);

// ── Table: per-job performance ─────────────────────────────
public record JobPerformanceDto(
    Guid JobId,
    string Title,
    string JobType,
    bool IsActive,
    bool IsApproved,
    DateTime ExpiresAt,
    int TotalApplications,
    int ScreeningCount,
    int InterviewCount,
    int OfferedCount,
    int RejectedCount
);

// ── Query params (period) ───────────────────────────────────
public record RecruiterStatsQuery(
    Guid CompanyId,
    DateTime StartDate,
    DateTime EndDate
);

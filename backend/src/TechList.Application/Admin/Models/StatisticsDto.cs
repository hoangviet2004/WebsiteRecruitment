namespace TechList.Application.Admin.Models;

// ── Overview Cards ──────────────────────────────────────────
public record OverviewStatsDto(
    int TotalUsers,
    int TotalCandidates,
    int TotalRecruiters,
    int TotalActiveJobs,
    int TotalJobs,
    int TotalCompanies,
    int TotalApplicationsEstimate,   // ước lượng từ jobs
    double UserGrowthPct,            // so với kỳ trước (%)
    double JobGrowthPct,
    double ApplicationGrowthPct,
    double CompanyGrowthPct,
    int PrevPeriodUsers,
    int PrevPeriodJobs,
    int PrevPeriodCompanies
);

// ── Line Chart: Time Series ────────────────────────────────
public record TimeSeriesPointDto(
    string Label,          // "2024-04-01" hoặc "Tuần 14" hoặc "Tháng 4"
    int NewUsers,
    int NewJobs
);

// ── Bar Chart: Top IT Skills ───────────────────────────────
public record SkillStatDto(
    string Skill,
    int Count
);

// ── Pie Chart: Job Type Distribution ─────────────────────
public record JobTypeStatDto(
    string JobType,
    int Count,
    double Percentage
);

// ── Horizontal Bar: Top Companies ────────────────────────
public record TopCompanyDto(
    string CompanyName,
    string? LogoUrl,
    int JobCount,
    int ActiveJobCount
);

// ── Table: Top Jobs by application count ─────────────────
public record TopJobDto(
    Guid JobId,
    string Title,
    string CompanyName,
    string JobType,
    string Location,
    int ApplicationCount,   // ước lượng
    bool IsActive,
    DateTime CreatedAt
);

// ── Table: Active Recruiters ──────────────────────────────
public record ActiveRecruiterDto(
    string UserId,
    string FullName,
    string Email,
    string CompanyName,
    int TotalJobs,
    int ActiveJobs,
    DateTime LastPostedAt
);

// ── Table: Candidate Stats ────────────────────────────────
public record CandidateSkillStatDto(
    string Category,   // "Kỹ năng" | "Kinh nghiệm" | "Địa điểm"
    string Value,
    int Count,
    double Percentage
);

// ── Query Params ──────────────────────────────────────────
public record StatisticsQueryDto(
    DateTime StartDate,
    DateTime EndDate,
    string? Period = "day"   // "day" | "week" | "month"
);

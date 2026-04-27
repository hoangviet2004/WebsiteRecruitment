using TechList.Application.Admin.Models;

namespace TechList.Application.Admin.Interfaces;

public interface IStatisticsService
{
    Task<OverviewStatsDto> GetOverviewAsync(StatisticsQueryDto query, CancellationToken ct);
    Task<List<TimeSeriesPointDto>> GetTimeSeriesAsync(StatisticsQueryDto query, CancellationToken ct);
    Task<List<SkillStatDto>> GetTopSkillsAsync(CancellationToken ct);
    Task<List<JobTypeStatDto>> GetJobTypeDistributionAsync(StatisticsQueryDto query, CancellationToken ct);
    Task<List<TopCompanyDto>> GetTopCompaniesAsync(StatisticsQueryDto query, CancellationToken ct);
    Task<List<TopJobDto>> GetTopJobsAsync(StatisticsQueryDto query, CancellationToken ct);
    Task<List<ActiveRecruiterDto>> GetActiveRecruitersAsync(StatisticsQueryDto query, CancellationToken ct);
    Task<List<CandidateSkillStatDto>> GetCandidateStatsAsync(CancellationToken ct);
}

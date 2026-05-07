using TechList.Application.Recruiters.Models;

namespace TechList.Application.Recruiters.Interfaces;

public interface IRecruiterStatisticsService
{
    Task<RecruiterOverviewDto> GetOverviewAsync(RecruiterStatsQuery query, CancellationToken ct);
    Task<List<AppStatusDistDto>> GetStatusDistributionAsync(Guid companyId, CancellationToken ct);
    Task<List<AppTrendPointDto>> GetApplicationTrendAsync(RecruiterStatsQuery query, CancellationToken ct);
    Task<List<CandSkillStatDto>> GetHotSkillsAsync(Guid companyId, CancellationToken ct);
    Task<List<JobPerformanceDto>> GetJobPerformanceAsync(RecruiterStatsQuery query, CancellationToken ct);
}

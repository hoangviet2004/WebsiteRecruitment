using TechList.Application.JobRecommendation.Models;

namespace TechList.Application.JobRecommendation.Interfaces;

public interface IJobRecommendationService
{
    Task<JobRecommendationResult> RecommendAsync(string candidateId, CancellationToken ct);
}

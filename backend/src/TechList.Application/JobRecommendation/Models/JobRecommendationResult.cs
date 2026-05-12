namespace TechList.Application.JobRecommendation.Models;

public record JobRecommendationItem(
    Guid   JobId,
    int    Score,
    string Reason
);

public record JobRecommendationResult(
    List<JobRecommendationItem> Recommendations
);

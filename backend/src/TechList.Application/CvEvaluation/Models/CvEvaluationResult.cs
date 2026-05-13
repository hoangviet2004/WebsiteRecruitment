namespace TechList.Application.CvEvaluation.Models;

public record CvEvaluationResult(
    int Score,
    string Summary,
    List<string> Strengths,
    List<string> Weaknesses,
    string Recommendation,
    string Details
);

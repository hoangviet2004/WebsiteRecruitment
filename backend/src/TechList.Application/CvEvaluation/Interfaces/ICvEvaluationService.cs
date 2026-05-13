using TechList.Application.CvEvaluation.Models;

namespace TechList.Application.CvEvaluation.Interfaces;

public interface ICvEvaluationService
{
    Task<CvEvaluationResult> EvaluateCvAsync(Guid applicationId, string recruiterId, CancellationToken ct);
}

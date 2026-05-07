namespace TechList.Application.SavedJobs.Models;

public sealed record SaveJobRequest(
    Guid JobPostId,
    string Collection = "Tất cả"
);

public sealed record UpdateCollectionRequest(
    string Collection
);

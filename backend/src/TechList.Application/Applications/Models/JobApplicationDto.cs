namespace TechList.Application.Applications.Models;

public record JobApplicationDto(
    Guid Id,
    Guid JobPostId,
    string JobTitle,
    string CandidateId,
    string CandidateName,
    string CandidateEmail,
    string? AvatarUrl,
    string? CvUrl,
    string? Skills,
    string Status,
    string? CoverLetter,
    DateTime AppliedAt,
    DateTime UpdatedAt
);

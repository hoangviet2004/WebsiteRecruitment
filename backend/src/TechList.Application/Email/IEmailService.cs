namespace TechList.Application.Email;

public interface IEmailService
{
    Task SendApplicationStatusEmailAsync(
        string toEmail,
        string candidateName,
        string jobTitle,
        string companyName,
        string newStatus,
        CancellationToken ct = default);

    Task SendInterviewScheduledEmailAsync(
        string toEmail,
        string candidateName,
        string jobTitle,
        string companyName,
        DateTime scheduledAt,
        int durationMinutes,
        string? meetingLink,
        string? location,
        string? notes,
        CancellationToken ct = default);
}

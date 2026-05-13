namespace TechList.Application.Notifications.Models;

public sealed record NotificationDto(
    Guid Id,
    string Title,
    string Message,
    string Type,
    Guid? JobPostId,
    string? JobTitle,
    bool IsRead,
    DateTime CreatedAt
);

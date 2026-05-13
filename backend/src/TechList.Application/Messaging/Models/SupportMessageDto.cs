using System;

namespace TechList.Application.Messaging.Models;

public record SupportMessageDto(
    Guid Id,
    string SenderId,
    string SenderName,
    string? SenderAvatar,
    string Content,
    bool IsRead,
    DateTime SentAt
);

public record SendSupportMessageRequest(
    string Content
);

using System;

namespace TechList.Domain.Entities;

public class SupportMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // The user (Recruiter or Candidate) who is chatting with support
    public string UserId { get; set; } = default!;

    // The sender of this specific message (could be UserId or an Admin's Id)
    public string SenderId { get; set; } = default!;

    public string Content { get; set; } = string.Empty;

    public bool IsRead { get; set; } = false;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}

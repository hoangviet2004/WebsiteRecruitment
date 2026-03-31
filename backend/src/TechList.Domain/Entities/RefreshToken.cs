namespace TechList.Domain.Entities;

public class RefreshToken
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = default!;

    // Store ONLY a hash in DB (never the plaintext refresh token).
    public string TokenHash { get; set; } = default!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }
    public string? RevokedByIp { get; set; }
    public string? CreatedByIp { get; set; }

    public string? ReplacedByTokenHash { get; set; }
    public string? UserAgent { get; set; }

    public bool IsActive => RevokedAt is null && ExpiresAt > DateTime.UtcNow;
}


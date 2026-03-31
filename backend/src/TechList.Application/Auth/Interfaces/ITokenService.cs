namespace TechList.Application.Auth.Interfaces;

public interface ITokenService
{
    Task<(string Jwt, int ExpiresInSeconds)> CreateAccessTokenAsync(UserTokenSubject subject, CancellationToken ct);
}

public sealed record UserTokenSubject(
    string UserId,
    string Email,
    string DisplayName,
    IReadOnlyList<string> Roles
);


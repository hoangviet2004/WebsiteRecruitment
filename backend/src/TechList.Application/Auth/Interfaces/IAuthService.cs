using TechList.Application.Auth.Models;

namespace TechList.Application.Auth.Interfaces;

public interface IAuthService
{
    Task RegisterAsync(RegisterRequest request, CancellationToken ct);
    Task<LoginResponse> LoginAsync(LoginRequest request, string? ip, string? userAgent, CancellationToken ct);
    Task<LoginResponse> RefreshAsync(string refreshToken, string? ip, string? userAgent, CancellationToken ct);
    Task LogoutAsync(string refreshToken, string? ip, CancellationToken ct);

    // Called from OAuth callbacks
    Task<LoginResponse> ExternalLoginAsync(string provider, string providerKey, string email, string? name, string? ip, string? userAgent, CancellationToken ct);
}


using System.Security.Cryptography;
using System.Text;
using TechList.Application.Auth.Interfaces;

namespace TechList.Infrastructure.Auth;

public sealed class RefreshTokenService : IRefreshTokenService
{
    public string GenerateRawToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    public string HashToken(string rawToken)
    {
        var bytes = Encoding.UTF8.GetBytes(rawToken);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash); // 64 chars
    }
}


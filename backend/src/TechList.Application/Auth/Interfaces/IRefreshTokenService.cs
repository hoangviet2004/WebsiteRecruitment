namespace TechList.Application.Auth.Interfaces;

public interface IRefreshTokenService
{
    string GenerateRawToken();
    string HashToken(string rawToken);
}


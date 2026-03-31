namespace TechList.Application.Auth.Models;

public sealed record AuthTokensResponse(
    string AccessToken,
    int AccessTokenExpiresIn,
    string RefreshToken
);


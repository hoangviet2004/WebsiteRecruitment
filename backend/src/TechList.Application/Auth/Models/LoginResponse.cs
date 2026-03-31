namespace TechList.Application.Auth.Models;

public sealed record LoginResponse(
    AuthTokensResponse Tokens,
    UserDto User
);


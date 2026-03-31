namespace TechList.Application.Auth.Models;

public sealed record RegisterRequest(
    string Email,
    string Password,
    string Role,
    string? DisplayName
);


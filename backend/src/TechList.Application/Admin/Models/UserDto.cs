namespace TechList.Application.Admin.Models;

public record UserDto(string Id, string Email, string DisplayName, string Role, DateTime CreatedAt);

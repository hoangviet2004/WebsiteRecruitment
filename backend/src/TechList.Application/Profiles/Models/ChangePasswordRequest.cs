namespace TechList.Application.Profiles.Models;

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword
);

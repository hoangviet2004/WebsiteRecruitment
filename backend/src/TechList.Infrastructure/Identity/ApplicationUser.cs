using Microsoft.AspNetCore.Identity;

namespace TechList.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // "Student" hoặc "Company"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
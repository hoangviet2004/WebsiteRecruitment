using Microsoft.AspNetCore.Identity;

namespace TechList.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    // Keep a minimal set of user fields in Identity table.
    // Extended profile data (avatar/bio/display name) lives in UserProfiles.
    public string FullName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
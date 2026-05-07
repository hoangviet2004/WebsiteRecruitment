using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace TechList.Infrastructure.Persistence;

/// <summary>
/// Design-time factory cho EF Core tools (migrations, database update...).
/// Suppresses PendingModelChangesWarning để tránh block khi model đang trong quá trình sync.
/// </summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=LONGVUX;Database=TechList;Trusted_Connection=True;TrustServerCertificate=True")
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
            .Options;

        return new AppDbContext(opts);
    }
}

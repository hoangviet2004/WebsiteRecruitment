using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TechList.Domain.Entities;
using TechList.Infrastructure.Identity; // ✅ Sửa namespace

namespace TechList.Infrastructure.Persistence;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<JobPost> JobPosts => Set<JobPost>();

    // ── Transaction Management ──
    public DbSet<ServicePackage> ServicePackages => Set<ServicePackage>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Identity table names (match your DB design)
        builder.Entity<ApplicationUser>().ToTable("Users");
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityRole>().ToTable("Roles");
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserRole<string>>().ToTable("UserRoles");
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserLogin<string>>().ToTable("ExternalLogins");
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserClaim<string>>().ToTable("UserClaims");
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityRoleClaim<string>>().ToTable("RoleClaims");
        builder.Entity<Microsoft.AspNetCore.Identity.IdentityUserToken<string>>().ToTable("UserTokens");

        builder.Entity<UserProfile>(e =>
        {
            e.ToTable("UserProfiles");
            e.HasKey(x => x.UserId);
            e.Property(x => x.DisplayName).HasMaxLength(200);
            e.Property(x => x.Bio).HasMaxLength(2000);
            e.Property(x => x.AvatarUrl).HasMaxLength(1000);
            e.Property(x => x.AvatarPublicId).HasMaxLength(200);
        });

        builder.Entity<RefreshToken>(e =>
        {
            e.ToTable("RefreshTokens");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.Property(x => x.TokenHash).HasMaxLength(128);
            e.Property(x => x.CreatedByIp).HasMaxLength(64);
            e.Property(x => x.RevokedByIp).HasMaxLength(64);
            e.Property(x => x.UserAgent).HasMaxLength(512);
            e.Property(x => x.ReplacedByTokenHash).HasMaxLength(128);
        });

        builder.Entity<Company>(e =>
        {
            e.ToTable("Companies");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(4000);
            e.Property(x => x.Website).HasMaxLength(300);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.LogoUrl).HasMaxLength(1000);
            e.Property(x => x.LogoPublicId).HasMaxLength(200);

            e.HasOne<ApplicationUser>()
             .WithMany()
             .HasForeignKey(x => x.OwnerId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<JobPost>(e =>
        {
            e.ToTable("JobPosts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(4000);
            e.Property(x => x.Requirements).HasMaxLength(4000);
            e.Property(x => x.Benefits).HasMaxLength(4000);
            e.Property(x => x.Location).HasMaxLength(200);
            e.Property(x => x.JobType).HasMaxLength(50);
            
            e.Property(x => x.MinSalary).HasColumnType("decimal(18,2)");
            e.Property(x => x.MaxSalary).HasColumnType("decimal(18,2)");

            e.HasOne(x => x.Company)
             .WithMany(c => c.Jobs)
             .HasForeignKey(x => x.CompanyId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ServicePackage ───────────────────────────────────
        builder.Entity<ServicePackage>(e =>
        {
            e.ToTable("ServicePackages");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Features).HasMaxLength(4000);
        });

        // ── Subscription ────────────────────────────────────
        builder.Entity<Subscription>(e =>
        {
            e.ToTable("Subscriptions");
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.Status).HasMaxLength(50).IsRequired();
            e.HasIndex(x => new { x.UserId, x.Status });

            e.HasOne(x => x.Package)
             .WithMany()
             .HasForeignKey(x => x.PackageId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Transaction ─────────────────────────────────────
        builder.Entity<Transaction>(e =>
        {
            e.ToTable("Transactions");
            e.HasKey(x => x.Id);
            e.Property(x => x.TransactionCode).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.TransactionCode).IsUnique();
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.CompanyName).HasMaxLength(200);
            e.Property(x => x.PaymentMethod).HasMaxLength(50);
            e.Property(x => x.Status).HasMaxLength(50);
            e.Property(x => x.PaymentGatewayRef).HasMaxLength(200);
            e.Property(x => x.StatusHistory).HasMaxLength(4000);
            e.Property(x => x.RefundReason).HasMaxLength(1000);
            e.Property(x => x.RefundedBy).HasMaxLength(450);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.CreatedAt);

            e.HasOne(x => x.Package)
             .WithMany()
             .HasForeignKey(x => x.PackageId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.Coupon)
             .WithMany()
             .HasForeignKey(x => x.CouponId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Coupon ───────────────────────────────────────────
        builder.Entity<Coupon>(e =>
        {
            e.ToTable("Coupons");
            e.HasKey(x => x.Id);
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.DiscountType).HasMaxLength(50);
            e.Property(x => x.ApplicablePackageIds).HasMaxLength(2000);
        });

        // ── AuditLog ────────────────────────────────────────
        builder.Entity<AuditLog>(e =>
        {
            e.ToTable("AuditLogs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(100).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            e.Property(x => x.EntityId).HasMaxLength(450).IsRequired();
            e.Property(x => x.PerformedBy).HasMaxLength(450).IsRequired();
            e.Property(x => x.Details).HasMaxLength(4000);
            e.HasIndex(x => x.CreatedAt);
        });
    }
}
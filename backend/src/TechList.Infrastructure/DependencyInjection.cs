using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TechList.Application.Auth.Interfaces;
using TechList.Application.Profiles.Interfaces;
using TechList.Infrastructure.Auth;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Options;
using TechList.Infrastructure.Persistence;
using TechList.Infrastructure.Profiles;

namespace TechList.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(config.GetConnectionString("DefaultConnection")));

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedEmail = false;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        services.Configure<JwtSettings>(config.GetSection(JwtSettings.SectionName));
        services.Configure<CloudinarySettings>(config.GetSection(CloudinarySettings.SectionName));

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddSingleton<IRefreshTokenService, RefreshTokenService>();

        services.AddScoped<IAvatarStorageService, CloudinaryAvatarStorageService>();
        services.AddScoped<IProfileService, ProfileService>();

        return services;
    }
}


using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TechList.Application.Auth.Interfaces;
using TechList.Application.Profiles.Interfaces;
using TechList.Application.Companies.Interfaces;
using TechList.Application.Jobs.Interfaces;
using TechList.Application.Applications.Interfaces;
using TechList.Application.Recruiters.Interfaces;
using TechList.Application.Messaging.Interfaces;
using TechList.Infrastructure.Auth;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Options;
using TechList.Infrastructure.Persistence;
using TechList.Infrastructure.Profiles;
using TechList.Infrastructure.Companies;
using TechList.Infrastructure.Jobs;
using TechList.Infrastructure.Applications;
using TechList.Infrastructure.Recruiters;
using TechList.Infrastructure.Messaging;
using TechList.Application.Admin.Interfaces;
using TechList.Infrastructure.Admin;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace TechList.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(config.GetConnectionString("DefaultConnection"))
                   .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));

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
        services.AddScoped<ICvStorageService, CloudinaryCvStorageService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<ICompanyService, CompanyService>();
        services.AddScoped<IJobService, JobService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IStatisticsService, StatisticsService>();
        services.AddScoped<ITransactionManagementService, TransactionManagementService>();
        services.AddScoped<IJobApplicationService, JobApplicationService>();
        services.AddScoped<IRecruiterStatisticsService, RecruiterStatisticsService>();
        services.AddScoped<IMessagingService, MessagingService>();
        services.AddScoped<IInterviewService, InterviewService>();
        services.AddMemoryCache();

        return services;
    }
}


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
using TechList.Application.CandidateMessaging.Interfaces;
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
using TechList.Infrastructure.CandidateMessaging;
using TechList.Application.Admin.Interfaces;
using TechList.Infrastructure.Admin;
using TechList.Application.SavedJobs.Interfaces;
using TechList.Infrastructure.SavedJobs;
using TechList.Application.Notifications.Interfaces;
using TechList.Infrastructure.Notifications;
using TechList.Application.CvEvaluation.Interfaces;
using TechList.Infrastructure.CvEvaluation;
using TechList.Application.JobRecommendation.Interfaces;
using TechList.Infrastructure.JobRecommendation;
using TechList.Application.Email;
using TechList.Infrastructure.Email;
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
        services.Configure<AnthropicSettings>(config.GetSection("Gemini"));
        services.Configure<EmailSettings>(config.GetSection(EmailSettings.SectionName));

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
        services.AddScoped<ICandidateMessagingService, CandidateMessagingService>();
        services.AddScoped<IInterviewService, InterviewService>();
        services.AddScoped<ISavedJobService, SavedJobService>();
        services.AddScoped<ISupportMessagingService, SupportMessagingService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<ICvEvaluationService, CvEvaluationService>();
        services.AddScoped<IJobRecommendationService, JobRecommendationService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddMemoryCache();

        return services;
    }
}


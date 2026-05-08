using System.Text;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using TechList.API.Common;
using TechList.API.Middleware;
using TechList.Application;
using TechList.Infrastructure;
using TechList.Infrastructure.Identity;
using TechList.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using TechList.Domain.Enums;
using TechList.Domain.Entities;
var builder = WebApplication.CreateBuilder(args);

// 1. Controllers & Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "TechList API", Version = "v1" });
    options.CustomSchemaIds(type => type.FullName);
    options.AddSecurityDefinition("Bearer", new()
    {
        Name         = "Authorization",
        Type         = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme       = "Bearer",
        BearerFormat = "JWT",
        In           = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description  = "Nhập token theo dạng: Bearer {token}"
    });
    options.AddSecurityRequirement(new()
    {
        {
            new() { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddTransient<ExceptionHandlingMiddleware>();
builder.Services.AddHttpClient();

builder.Services.AddFluentValidationAutoValidation();

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(kvp => kvp.Value?.Errors.Count > 0)
            .SelectMany(kvp => kvp.Value!.Errors.Select(e => new ApiError(kvp.Key, e.ErrorMessage)))
            .ToList();

        return new BadRequestObjectResult(ApiResponse<object>.Fail("Validation failed", errors));
    };
});

// 4. JWT + Google + GitHub
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer              = jwtSettings["Issuer"],
        ValidAudience            = jwtSettings["Audience"],
        IssuerSigningKey         = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!))
    };
})
.AddCookie(IdentityConstants.ExternalScheme)
.AddGoogle(options =>
{
    options.ClientId     = builder.Configuration["OAuth:Google:ClientId"]!;
    options.ClientSecret = builder.Configuration["OAuth:Google:ClientSecret"]!;
    options.SignInScheme = IdentityConstants.ExternalScheme;
})
.AddGitHub(options =>
{
    options.ClientId     = builder.Configuration["OAuth:GitHub:ClientId"]!;
    options.ClientSecret = builder.Configuration["OAuth:GitHub:ClientSecret"]!;
    options.Scope.Add("user:email");
    options.SignInScheme = IdentityConstants.ExternalScheme;
});

// 5. CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        // Dev: cho phép mọi origin gọi API (frontend auth dùng Authorization header, không cần cookie).
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// TODO: Thêm sau khi tạo file
// builder.Services.AddAutoMapper(...)
// builder.Services.AddMediatR(...)
// builder.Services.AddFluentValidation(...)
// builder.Services.AddSingleton(new Cloudinary(...))

// ──── BUILD APP ────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var db = services.GetRequiredService<AppDbContext>();
        // Tự động cập nhật cấu trúc Database (Fix lỗi thiếu cột ApplicationLimit)
        await db.Database.MigrateAsync();

        foreach (var role in AppRole.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var seedUsers = new List<(string Email, string Password, string Role, string FullName, string DisplayName, string Bio, 
                                  string CompName, string CompTax, string CompEmail, string CompPhone, string CompWeb, string CompSize, string CompAddr, string CompDesc)>
        {
            ("admin@techlist.com", "Admin@123", AppRole.Admin, "System Admin", "Super Admin", "Quản trị viên", "", "", "", "", "", "", "", ""),
            
            ("congty1@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "NovaTech", "Tuyển dụng AI", 
             "Công ty Cổ phần Công nghệ NovaTech", "0101234567", "contact@novatech.vn", "0243123456", "https://novatech.vn", "500-1000", "Tòa nhà Keangnam, Hà Nội", 
             "NovaTech dẫn đầu trong lĩnh vực Trí tuệ nhân tạo và xử lý dữ liệu lớn tại Việt Nam. Với đội ngũ hơn 500 chuyên gia, chúng tôi tập trung phát triển các giải pháp học máy ứng dụng trong y tế, tài chính và quản lý đô thị thông minh. Tầm nhìn của chúng tôi là đưa công nghệ AI Việt Nam vươn tầm quốc tế thông qua các sản phẩm mang tính đột phá và thực tiễn cao."),

            ("congty2@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "SkyVision", "HR Lead", 
             "Tập đoàn Công nghệ SkyVision", "0107654321", "info@skyvision.com", "0243987654", "https://skyvision.com", "100-200", "Lotte Center, Hà Nội", 
             "SkyVision chuyên cung cấp các giải pháp IoT và Smart City cho các đô thị hiện đại. Chúng tôi tự hào là đơn vị tiên phong trong việc tích hợp công nghệ cảm biến và truyền dẫn không dây để tối ưu hóa hạ tầng giao thông và năng lượng. Sứ mệnh của SkyVision là kiến tạo một môi trường sống thông minh, an toàn và bền vững cho mọi công dân thông qua sức mạnh của kết nối vạn vật."),

            ("congty3@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "GlobalSoft", "Tuyển dụng", 
             "Công ty TNHH Phần mềm Toàn Cầu (GlobalSoft)", "0301122334", "hr@globalsoft.com.vn", "0283822334", "https://globalsoft.com.vn", "1000+", "Quận 1, TP. Hồ Chí Minh", 
             "GlobalSoft là đối tác chiến lược về gia công phần mềm cho các tập đoàn Fortune 500. Với quy mô nhân sự hơn 1000 người và quy trình làm việc chuẩn Agile, chúng tôi cung cấp dịch vụ phát triển phần mềm toàn diện từ tư vấn kiến trúc đến vận hành hệ thống. GlobalSoft cam kết mang lại giá trị vượt trội thông qua sự kết hợp giữa kỹ năng kỹ thuật xuất sắc và hiểu biết sâu sắc về nghiệp vụ kinh doanh toàn cầu."),

            ("congty4@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "Infinity Digital", "HR Manager", 
             "Công ty Truyền thông Số Infinity", "0304455667", "hello@infinity.digital", "0283944556", "https://infinity.digital", "50-100", "Quận 3, TP. Hồ Chí Minh", 
             "Chúng tôi kiến tạo các giải pháp Marketing Tech và AdTech dựa trên nền tảng dữ liệu người dùng và phân tích hành vi. Infinity Digital không chỉ cung cấp công cụ quảng cáo mà còn giúp doanh nghiệp tối ưu hóa hành trình khách hàng thông qua các thuật toán dự báo tiên tiến. Với môi trường làm việc năng động và sáng tạo, chúng tôi luôn đi đầu trong việc áp dụng các xu hướng công nghệ truyền thông số mới nhất."),

            ("congty5@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "FutureLink", "Talent Hunter", 
             "Công ty Giải pháp Chuỗi khối FutureLink", "0307788990", "jobs@futurelink.io", "0283778899", "https://futurelink.io", "20-50", "Khu Công nghệ cao, TP.HCM", 
             "FutureLink đi đầu trong việc ứng dụng Blockchain và Web3 vào thực tiễn doanh nghiệp. Chúng tôi tập trung xây dựng các nền tảng phi tập trung cho quản lý chuỗi cung ứng, xác thực danh tính số và hợp đồng thông minh. Với đội ngũ kỹ sư tâm huyết, FutureLink đang nỗ lực định nghĩa lại cách thức giao dịch và lưu trữ thông tin trong kỷ nguyên internet thế hệ mới, đảm bảo tính minh bạch và bảo mật tuyệt đối."),

            ("congty6@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "TechBridge", "Recruiter", 
             "Công ty Giáo dục Công nghệ TechBridge", "1801234567", "support@techbridge.edu.vn", "02923123456", "https://techbridge.edu.vn", "100-300", "Quận Ninh Kiều, Cần Thơ", 
             "TechBridge kết nối tri thức thông qua các nền tảng học tập trực tuyến tiên tiến và hệ thống quản lý đào tạo thông minh. Chúng tôi tin rằng công nghệ là chìa khóa để xóa bỏ rào cản địa lý trong giáo dục. Các sản phẩm của TechBridge ứng dụng Gamification và AI để cá nhân hóa lộ trình học tập, giúp học viên tiếp cận kiến thức một cách hứng thú và hiệu quả nhất, góp phần nâng cao chất lượng nguồn nhân lực cho khu vực và cả nước."),

            ("congty7@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "BlueOcean", "HR Specialist", 
             "Công ty TMĐT Đại Dương Xanh", "0309988776", "hr@blueocean.vn", "0283556677", "https://blueocean.vn", "300-500", "Quận 7, TP. Hồ Chí Minh", 
             "BlueOcean vận hành hệ sinh thái thương mại điện tử và logistics tích hợp, kết nối hàng triệu nhà bán hàng với người tiêu dùng trên khắp khu vực. Chúng tôi không ngừng đầu tư vào hệ thống quản trị kho bãi thông minh và tối ưu hóa tuyến đường vận chuyển để rút ngắn thời gian giao hàng. Tầm nhìn của BlueOcean là trở thành nền tảng TMĐT tin cậy nhất, mang lại trải nghiệm mua sắm không giới hạn và hỗ trợ doanh nghiệp Việt vươn ra biển lớn."),

            ("congty8@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "NextGen", "Head of HR", 
             "Công ty Tài chính Công nghệ NextGen", "0105544332", "hr@nextgen.finance", "0243223344", "https://nextgen.finance", "150-250", "Hai Bà Trưng, Hà Nội", 
             "NextGen mang đến cuộc cách mạng trong lĩnh vực ngân hàng số và thanh toán trực tuyến thông qua các giải pháp FinTech đột phá. Chúng tôi tập trung vào việc đơn giản hóa các giao dịch tài chính phức tạp và tăng cường khả năng tiếp cận vốn cho cá nhân và doanh nghiệp nhỏ. Với hệ thống bảo mật đa lớp và giao diện thân thiện, NextGen đang từng bước thay đổi thói quen quản lý tài chính của người dùng, hướng tới một xã hội không dùng tiền mặt."),

            ("congty9@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "SmartVision", "Recruiter", 
             "Công ty Giải pháp Thị giác Thông minh", "0401234888", "hr@smartvision.ai", "02363123888", "https://smartvision.ai", "30-70", "Quận Liên Chiểu, Đà Nẵng", 
             "Chuyên nghiên cứu và phát triển AI trong lĩnh vực nhận diện hình ảnh, xử lý video thời gian thực và bảo mật sinh trắc học. SmartVision cung cấp các giải pháp phân tích dữ liệu hình ảnh cho an ninh, bán lẻ và sản xuất công nghiệp. Chúng tôi tự hào sở hữu những thuật toán Deep Learning đạt độ chính xác cao nhất, giúp doanh nghiệp tự động hóa quy trình kiểm soát và nâng cao năng suất vận hành một cách đáng kể."),

            ("congty10@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "DigiWave", "HR Lead", 
             "Công ty An ninh mạng DigiWave", "0302233445", "security@digiwave.vn", "0283844556", "https://digiwave.vn", "80-150", "Tân Bình, TP. Hồ Chí Minh", 
             "DigiWave cung cấp các giải pháp bảo mật toàn diện cho hạ tầng số của doanh nghiệp, từ phòng chống tấn công mạng đến ứng cứu sự cố an ninh thông tin. Trong bối cảnh các mối đe dọa kỹ thuật số ngày càng phức tạp, chúng tôi đóng vai trò là lá chắn vững chắc bảo vệ tài sản số và dữ liệu nhạy cảm của khách hàng. DigiWave kết hợp giữa công nghệ giám sát 24/7 và tư vấn chiến lược để đảm bảo sự vận hành liên tục và an toàn của hệ thống."),

            ("candidate@techlist.com", "Candidate@123", AppRole.Candidate, "Nguyễn Văn A", "Software Engineer", "Lập trình viên", "", "", "", "", "", "", "", "")
        };

        foreach (var (email, password, role, fullName, displayName, bio, compName, compTax, compEmail, compPhone, compWeb, compSize, compAddr, compDesc) in seedUsers)
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true,
                    FullName = fullName,
                    CreatedAt = DateTime.UtcNow
                };
                var result = await userManager.CreateAsync(user, password);
                if (result.Succeeded)
                {
                    await userManager.AddToRoleAsync(user, role);
                }
            }
            else 
            {
                // Đồng bộ lại FullName nếu có thay đổi
                user.FullName = fullName;
                await userManager.UpdateAsync(user);
            }

            if (user != null)
            {
                // 1. Đồng bộ UserProfile
                var profile = await db.UserProfiles.FindAsync(user.Id);
                if (profile == null)
                {
                    db.UserProfiles.Add(new UserProfile
                    {
                        UserId = user.Id,
                        DisplayName = displayName,
                        Bio = bio,
                        IsApproved = true,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else 
                {
                    profile.DisplayName = displayName;
                    profile.Bio = bio;
                    profile.UpdatedAt = DateTime.UtcNow;
                }

                // 2. Đồng bộ Company, Subscription và JobPosts (nếu là Recruiter)
                if (role == AppRole.Recruiter)
                {
                    var company = await db.Companies.FirstOrDefaultAsync(c => c.OwnerId == user.Id);
                    if (company == null)
                    {
                        company = new Company
                        {
                            OwnerId = user.Id,
                            Name = compName,
                            Description = compDesc,
                            Website = compWeb,
                            Address = compAddr,
                            CompanySize = compSize,
                            ContactEmail = compEmail,
                            ContactPhone = compPhone,
                            TaxCode = compTax,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        db.Companies.Add(company);
                    }
                    else 
                    {
                        company.Name = compName;
                        company.Description = compDesc;
                        company.Website = compWeb;
                        company.Address = compAddr;
                        company.CompanySize = compSize;
                        company.ContactEmail = compEmail;
                        company.ContactPhone = compPhone;
                        company.TaxCode = compTax;
                        company.UpdatedAt = DateTime.UtcNow;
                    }

                    // Tự động gán gói Free nếu chưa có (Mặc định ID từ DbContext seed)
                    var freePackageId = Guid.Parse("11111111-1111-1111-1111-111111111111");
                    var hasSub = await db.Subscriptions.AnyAsync(s => s.UserId == user.Id);
                    if (!hasSub)
                    {
                        db.Subscriptions.Add(new Subscription
                        {
                            UserId = user.Id,
                            PackageId = freePackageId,
                            StartDate = DateTime.UtcNow,
                            EndDate = DateTime.UtcNow.AddYears(1),
                            Status = SubscriptionStatus.Active,
                            IsSelected = true
                        });
                    }

                    // Tự động đăng 2 tin tuyển dụng mẫu nếu chưa có việc làm nào
                    await db.SaveChangesAsync(); // Lưu Company trước để lấy ID
                    var jobCount = await db.JobPosts.CountAsync(j => j.CompanyId == company.Id);
                    if (jobCount < 2)
                    {
                        db.JobPosts.Add(new JobPost
                        {
                            CompanyId = company.Id,
                            Title = $"Kỹ sư {displayName} (Senior Level)",
                            Description = $"Cơ hội gia nhập đội ngũ chuyên gia tại {compName} để tham gia vào các dự án chiến lược. {compDesc}",
                            Requirements = "• Ít nhất 3-5 năm kinh nghiệm thực chiến.\n• Tư duy hệ thống và khả năng giải quyết vấn đề phức tạp.\n• Tiếng Anh giao tiếp tốt là một lợi thế.",
                            Benefits = "• Lương tháng 13 + Thưởng hiệu quả công việc hàng năm.\n• Bảo hiểm sức khỏe cao cấp cho nhân viên và người thân.\n• Review lương 2 lần/năm.",
                            MinSalary = 2000,
                            MaxSalary = 4500,
                            Location = compAddr,
                            JobType = "Full-time",
                            Experience = "3-5 năm",
                            Education = "Cử nhân CNTT",
                            ApplicationLimit = 50,
                            ExpiresAt = DateTime.UtcNow.AddDays(30)
                        });

                        db.JobPosts.Add(new JobPost
                        {
                            CompanyId = company.Id,
                            Title = $"Chuyên viên {displayName} (Middle/Junior)",
                            Description = $"Chúng tôi tìm kiếm những cộng sự trẻ trung, nhiệt huyết để cùng bứt phá tại môi trường năng động của {compName}.",
                            Requirements = "• Có kiến thức nền tảng vững chắc về quy trình phát triển phần mềm.\n• Ham học hỏi, sẵn sàng tiếp cận các công nghệ mới.\n• Kỹ năng làm việc nhóm tốt.",
                            Benefits = "• Lộ trình thăng tiến rõ ràng (Career Path).\n• Tài trợ các khóa học chứng chỉ quốc tế.\n• Company trip, teambuilding hàng quý.",
                            MinSalary = 1000,
                            MaxSalary = 1800,
                            Location = compAddr,
                            JobType = "Hybrid",
                            Experience = "1-2 năm",
                            Education = "Đại học",
                            ApplicationLimit = 100,
                            ExpiresAt = DateTime.UtcNow.AddDays(45)
                        });
                    }
                }
            }
        }
        await db.SaveChangesAsync();
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
// app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
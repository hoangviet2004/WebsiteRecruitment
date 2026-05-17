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
builder.Services.AddOutputCache(opts =>
{
    opts.AddBasePolicy(b => b.Expire(TimeSpan.FromSeconds(30)));
});
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
             "Tập đoàn Công nghệ SkyVision", "0107654321", "info@skyvision.com", "0243987654", "https://skyvision.com", "50-150", "Lotte Center, Hà Nội", 
             "SkyVision chuyên cung cấp các giải pháp IoT và Smart City cho các đô thị hiện đại. Chúng tôi tự hào là đơn vị tiên phong trong việc tích hợp công nghệ cảm biến và truyền dẫn không dây để tối ưu hóa hạ tầng giao thông và năng lượng. Sứ mệnh của SkyVision là kiến tạo một môi trường sống thông minh, an toàn và bền vững cho mọi công dân thông qua sức mạnh của kết nối vạn vật."),

            ("congty3@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "GlobalSoft", "Tuyển dụng", 
             "Công ty TNHH Phần mềm Toàn Cầu (GlobalSoft)", "0301122334", "hr@globalsoft.com.vn", "0283822334", "https://globalsoft.com.vn", "1000+", "Quận 1, TP. Hồ Chí Minh", 
             "GlobalSoft là đối tác chiến lược về gia công phần mềm cho các tập đoàn Fortune 500. Với quy mô nhân sự hơn 1000 người và quy trình làm việc chuẩn Agile, chúng tôi cung cấp dịch vụ phát triển phần mềm toàn diện từ tư vấn kiến trúc đến vận hành hệ thống. GlobalSoft cam kết mang lại giá trị vượt trội thông qua sự kết hợp giữa kỹ năng kỹ thuật xuất sắc và hiểu biết sâu sắc về nghiệp vụ kinh doanh toàn cầu."),

            ("congty4@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "Infinity Digital", "HR Manager", 
             "Công ty Truyền thông Số Infinity", "0304455667", "hello@infinity.digital", "0283944556", "https://infinity.digital", "50-150", "Quận 3, TP. Hồ Chí Minh", 
             "Chúng tôi kiến tạo các giải pháp Marketing Tech và AdTech dựa trên nền tảng dữ liệu người dùng và phân tích hành vi. Infinity Digital không chỉ cung cấp công cụ quảng cáo mà còn giúp doanh nghiệp tối ưu hóa hành trình khách hàng thông qua các thuật toán dự báo tiên tiến. Với môi trường làm việc năng động và sáng tạo, chúng tôi luôn đi đầu trong việc áp dụng các xu hướng công nghệ truyền thông số mới nhất."),

            ("congty5@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "FutureLink", "Talent Hunter", 
             "Công ty Giải pháp Chuỗi khối FutureLink", "0307788990", "jobs@futurelink.io", "0283778899", "https://futurelink.io", "1-50", "Khu Công nghệ cao, TP.HCM", 
             "FutureLink đi đầu trong việc ứng dụng Blockchain và Web3 vào thực tiễn doanh nghiệp. Chúng tôi tập trung xây dựng các nền tảng phi tập trung cho quản lý chuỗi cung ứng, xác thực danh tính số và hợp đồng thông minh. Với đội ngũ kỹ sư tâm huyết, FutureLink đang nỗ lực định nghĩa lại cách thức giao dịch và lưu trữ thông tin trong kỷ nguyên internet thế hệ mới, đảm bảo tính minh bạch và bảo mật tuyệt đối."),

            ("congty6@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "TechBridge", "Recruiter", 
             "Công ty Giáo dục Công nghệ TechBridge", "1801234567", "support@techbridge.edu.vn", "02923123456", "https://techbridge.edu.vn", "150-300", "Quận Ninh Kiều, Cần Thơ", 
             "TechBridge kết nối tri thức thông qua các nền tảng học tập trực tuyến tiên tiến và hệ thống quản lý đào tạo thông minh. Chúng tôi tin rằng công nghệ là chìa khóa để xóa bỏ rào cản địa lý trong giáo dục. Các sản phẩm của TechBridge ứng dụng Gamification và AI để cá nhân hóa lộ trình học tập, giúp học viên tiếp cận kiến thức một cách hứng thú và hiệu quả nhất, góp phần nâng cao chất lượng nguồn nhân lực cho khu vực và cả nước."),

            ("congty7@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "BlueOcean", "HR Specialist", 
             "Công ty TMĐT Đại Dương Xanh", "0309988776", "hr@blueocean.vn", "0283556677", "https://blueocean.vn", "300-500", "Quận 7, TP. Hồ Chí Minh", 
             "BlueOcean vận hành hệ sinh thái thương mại điện tử và logistics tích hợp, kết nối hàng triệu nhà bán hàng với người tiêu dùng trên khắp khu vực. Chúng tôi không ngừng đầu tư vào hệ thống quản trị kho bãi thông minh và tối ưu hóa tuyến đường vận chuyển để rút ngắn thời gian giao hàng. Tầm nhìn của BlueOcean là trở thành nền tảng TMĐT tin cậy nhất, mang lại trải nghiệm mua sắm không giới hạn và hỗ trợ doanh nghiệp Việt vươn ra biển lớn."),

            ("congty8@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "NextGen", "Head of HR", 
             "Công ty Tài chính Công nghệ NextGen", "0105544332", "hr@nextgen.finance", "0243223344", "https://nextgen.finance", "150-300", "Hai Bà Trưng, Hà Nội", 
             "NextGen mang đến cuộc cách mạng trong lĩnh vực ngân hàng số và thanh toán trực tuyến thông qua các giải pháp FinTech đột phá. Chúng tôi tập trung vào việc đơn giản hóa các giao dịch tài chính phức tạp và tăng cường khả năng tiếp cận vốn cho cá nhân và doanh nghiệp nhỏ. Với hệ thống bảo mật đa lớp và giao diện thân thiện, NextGen đang từng bước thay đổi thói quen quản lý tài chính của người dùng, hướng tới một xã hội không dùng tiền mặt."),

            ("congty9@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "SmartVision", "Recruiter", 
             "Công ty Giải pháp Thị giác Thông minh", "0401234888", "hr@smartvision.ai", "02363123888", "https://smartvision.ai", "50-150", "Quận Liên Chiểu, Đà Nẵng", 
             "Chuyên nghiên cứu và phát triển AI trong lĩnh vực nhận diện hình ảnh, xử lý video thời gian thực và bảo mật sinh trắc học. SmartVision cung cấp các giải pháp phân tích dữ liệu hình ảnh cho an ninh, bán lẻ và sản xuất công nghiệp. Chúng tôi tự hào sở hữu những thuật toán Deep Learning đạt độ chính xác cao nhất, giúp doanh nghiệp tự động hóa quy trình kiểm soát và nâng cao năng suất vận hành một cách đáng kể."),

            ("congty10@gmail.com", "Congty@123", AppRole.Recruiter, "HR Manager", "DigiWave", "HR Lead", 
             "Công ty An ninh mạng DigiWave", "0302233445", "security@digiwave.vn", "0283844556", "https://digiwave.vn", "50-150", "Tân Bình, TP. Hồ Chí Minh", 
             "DigiWave cung cấp các giải pháp bảo mật toàn diện cho hạ tầng số của doanh nghiệp, từ phòng chống tấn công mạng đến ứng cứu sự cố an ninh thông tin. Trong bối cảnh các mối đe dọa kỹ thuật số ngày càng phức tạp, chúng tôi đóng vai trò là lá chắn vững chắc bảo vệ tài sản số và dữ liệu nhạy cảm của khách hàng. DigiWave kết hợp giữa công nghệ giám sát 24/7 và tư vấn chiến lược để đảm bảo sự vận hành liên tục và an toàn của hệ thống."),

            ("candidate@techlist.com", "Candidate@123", AppRole.Candidate, "Nguyễn Văn A", "Software Engineer", "Lập trình viên", "", "", "", "", "", "", "", ""),

            ("ungvien1@gmail.com",  "Ungvien@123", AppRole.Candidate, "Nguyễn Minh Khoa",   "Minh Khoa",   "Frontend Developer với 2 năm kinh nghiệm ReactJS và TypeScript.", "", "", "", "", "", "", "", ""),
            ("ungvien2@gmail.com",  "Ungvien@123", AppRole.Candidate, "Trần Thị Lan Anh",   "Lan Anh",     "UI/UX Designer đam mê thiết kế sản phẩm số lấy người dùng làm trung tâm.", "", "", "", "", "", "", "", ""),
            ("ungvien3@gmail.com",  "Ungvien@123", AppRole.Candidate, "Lê Hoàng Phúc",      "Hoàng Phúc",  "Backend Developer chuyên .NET Core và microservices, 3 năm kinh nghiệm.", "", "", "", "", "", "", "", ""),
            ("ungvien4@gmail.com",  "Ungvien@123", AppRole.Candidate, "Phạm Ngọc Huyền",    "Ngọc Huyền",  "Data Analyst với kỹ năng Python, SQL và Power BI, đang tìm cơ hội mới.", "", "", "", "", "", "", "", ""),
            ("ungvien5@gmail.com",  "Ungvien@123", AppRole.Candidate, "Võ Tuấn Kiệt",       "Tuấn Kiệt",   "Mobile Developer iOS/Android, có kinh nghiệm Flutter và Swift.", "", "", "", "", "", "", "", ""),
            ("ungvien6@gmail.com",  "Ungvien@123", AppRole.Candidate, "Ngô Thị Thu Trang",  "Thu Trang",   "QA Engineer chuyên kiểm thử tự động với Selenium và Cypress.", "", "", "", "", "", "", "", ""),
            ("ungvien7@gmail.com",  "Ungvien@123", AppRole.Candidate, "Đặng Quốc Bảo",      "Quốc Bảo",    "DevOps Engineer, thành thạo Docker, Kubernetes và CI/CD pipeline.", "", "", "", "", "", "", "", ""),
            ("ungvien8@gmail.com",  "Ungvien@123", AppRole.Candidate, "Bùi Khánh Linh",     "Khánh Linh",  "Fullstack Developer MERN stack, đã tham gia 5 dự án startup.", "", "", "", "", "", "", "", ""),
            ("ungvien9@gmail.com",  "Ungvien@123", AppRole.Candidate, "Hoàng Đức Mạnh",     "Đức Mạnh",    "AI/ML Engineer với kinh nghiệm TensorFlow và PyTorch, nghiên cứu NLP.", "", "", "", "", "", "", "", ""),
            ("ungvien10@gmail.com", "Ungvien@123", AppRole.Candidate, "Phan Thị Mỹ Duyên",  "Mỹ Duyên",   "Business Analyst, cầu nối giữa kỹ thuật và nghiệp vụ, thành thạo BPMN.", "", "", "", "", "", "", "", "")
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
                            EndDate = DateTime.UtcNow.AddYears(100),
                            Status = SubscriptionStatus.Active,
                            IsSelected = true
                        });
                    }

                    // ── Nội dung tin tuyển dụng chuẩn ──────────────────────
                    const string seniorDesc =
                        "• Thiết kế, phát triển và triển khai các giải pháp phần mềm phức tạp, có khả năng mở rộng cao.\n" +
                        "• Dẫn dắt nhóm kỹ thuật, thực hiện code review và mentor cho các thành viên junior.\n" +
                        "• Tham gia vào các quyết định kiến trúc hệ thống và lựa chọn công nghệ phù hợp với yêu cầu dự án.\n" +
                        "• Tối ưu hóa hiệu suất hệ thống, xử lý bottleneck và đảm bảo khả năng chịu tải cao.\n" +
                        "• Phối hợp với Product Owner và stakeholder để chuyển hóa yêu cầu kinh doanh thành giải pháp kỹ thuật.";

                    const string seniorReqs =
                        "• Có ít nhất 3-5 năm kinh nghiệm phát triển phần mềm thực tế.\n" +
                        "• Thành thạo ít nhất một ngôn ngữ backend: Java/Spring Boot, Node.js, .NET hoặc Python.\n" +
                        "• Kinh nghiệm với kiến trúc Microservices, RESTful APIs.\n" +
                        "• Hiểu biết sâu về cơ sở dữ liệu SQL và NoSQL (PostgreSQL, MongoDB, Redis).\n" +
                        "• Kinh nghiệm với Docker, Kubernetes, CI/CD pipeline.\n" +
                        "• Kỹ năng giao tiếp tốt, có khả năng làm việc trong môi trường Agile/Scrum.\n" +
                        "• Kinh nghiệm với Cloud platforms (AWS, GCP, Azure) là lợi thế.\n" +
                        "• Tư duy phân tích tốt, chủ động và chịu trách nhiệm cao.";

                    const string seniorBenefits =
                        "• Mức lương cạnh tranh, review 2 lần/năm theo hiệu suất.\n" +
                        "• Bảo hiểm sức khỏe cao cấp cho nhân viên và người thân.\n" +
                        "• Lộ trình thăng tiến rõ ràng lên Tech Lead / Principal Engineer.\n" +
                        "• Cơ hội tham gia dự án quốc tế, làm việc với chuyên gia nước ngoài.\n" +
                        "• Budget học tập hàng năm để tham gia các khóa học và hội nghị công nghệ.";

                    const string juniorDesc =
                        "• Phối hợp với đội ngũ phát triển để thiết kế, phát triển và triển khai các giải pháp phần mềm chất lượng cao.\n" +
                        "• Đóng góp vào các tác vụ phát triển fullstack, đảm bảo tích hợp và chức năng liền mạch.\n" +
                        "• Kiểm tra và khắc phục lỗi (debug) để duy trì hiệu suất tối ưu và trải nghiệm người dùng.\n" +
                        "• Cập nhật các công nghệ mới và các phương pháp hay nhất (best practices) trong phát triển phần mềm.\n" +
                        "• Giao tiếp hiệu quả với các thành viên trong nhóm để đảm bảo đáp ứng các yêu cầu của dự án.";

                    const string juniorReqs =
                        "• Đang là sinh viên năm cuối hoặc mới tốt nghiệp ngành CNTT tại các trường Đại học.\n" +
                        "• Kỹ năng giao tiếp tiếng Anh tốt (cả nói và viết).\n" +
                        "• Có thể làm việc fulltime trong suốt thời gian thực tập.\n" +
                        "• Kiến thức vững chắc về một trong hai framework: Spring Boot hoặc Node.js.\n" +
                        "• Có hiểu biết về RESTful APIs, OOP (Lập trình hướng đối tượng) và Design Patterns.\n" +
                        "• Có kiến thức và kinh nghiệm về thiết kế cơ sở dữ liệu SQL, Git, CI/CD là một lợi thế.\n" +
                        "• Chủ động, có trách nhiệm và ham học hỏi.\n" +
                        "• Có khả năng làm việc độc lập cũng như làm việc nhóm.";

                    const string juniorBenefits =
                        "• Cơ hội trở thành nhân viên chính thức sau kỳ thực tập (3 tháng thực tập).\n" +
                        "• Có lộ trình thăng tiến rõ ràng.\n" +
                        "• Cơ hội tham gia các dự án quốc tế và làm việc với khách hàng nước ngoài.\n" +
                        "• Được dẫn dắt, đào tạo bởi các lập trình viên dày dặn kinh nghiệm (senior).\n" +
                        "• Môi trường làm việc linh hoạt và hỗ trợ lẫn nhau.";

                    // ── Cập nhật hoặc thêm mới tin tuyển dụng ──────────────
                    await db.SaveChangesAsync(); // Lưu Company trước để lấy ID
                    var existingJobs = await db.JobPosts
                        .Where(j => j.CompanyId == company.Id)
                        .ToListAsync();

                    if (existingJobs.Count >= 2)
                    {
                        // Cập nhật nội dung tin đã có
                        var senior = existingJobs.FirstOrDefault(j => j.Title.Contains("Senior"));
                        var junior = existingJobs.FirstOrDefault(j => j.Title.Contains("Middle") || j.Title.Contains("Junior"));

                        if (senior != null)
                        {
                            senior.Description  = seniorDesc;
                            senior.Requirements = seniorReqs;
                            senior.Benefits     = seniorBenefits;
                            senior.Experience   = "3-5 năm";
                            senior.Education    = "Cử nhân CNTT";
                            senior.MinSalary    = 2000;
                            senior.MaxSalary    = 4500;
                            senior.JobType      = "Full-time";
                            senior.UpdatedAt    = DateTime.UtcNow;
                        }
                        if (junior != null)
                        {
                            junior.Description  = juniorDesc;
                            junior.Requirements = juniorReqs;
                            junior.Benefits     = juniorBenefits;
                            junior.Experience   = "Dưới 1 năm";
                            junior.Education    = "Đại học";
                            junior.MinSalary    = 1000;
                            junior.MaxSalary    = 1800;
                            junior.JobType      = "Full-time";
                            junior.UpdatedAt    = DateTime.UtcNow;
                        }
                    }
                    else
                    {
                        // Thêm mới nếu chưa có
                        db.JobPosts.Add(new JobPost
                        {
                            CompanyId        = company.Id,
                            Title            = $"Kỹ sư phần mềm {displayName} (Senior Level)",
                            Description      = seniorDesc,
                            Requirements     = seniorReqs,
                            Benefits         = seniorBenefits,
                            MinSalary        = 2000,
                            MaxSalary        = 4500,
                            Location         = compAddr,
                            JobType          = "Full-time",
                            Experience       = "3-5 năm",
                            Education        = "Cử nhân CNTT",
                            ApplicationLimit = 50,
                            ExpiresAt        = DateTime.UtcNow.AddDays(30)
                        });
                        db.JobPosts.Add(new JobPost
                        {
                            CompanyId        = company.Id,
                            Title            = $"Thực tập sinh / Junior Developer tại {displayName}",
                            Description      = juniorDesc,
                            Requirements     = juniorReqs,
                            Benefits         = juniorBenefits,
                            MinSalary        = 1000,
                            MaxSalary        = 1800,
                            Location         = compAddr,
                            JobType          = "Full-time",
                            Experience       = "Dưới 1 năm",
                            Education        = "Đại học",
                            ApplicationLimit = 100,
                            ExpiresAt        = DateTime.UtcNow.AddDays(45)
                        });
                    }

                    // Cập nhật lại số lượng tin đã dùng (JobPostsUsed) để hiển thị đúng trên giao diện
                    var currentSub = await db.Subscriptions.FirstOrDefaultAsync(s => s.UserId == user.Id && s.Status == SubscriptionStatus.Active);
                    if (currentSub != null)
                    {
                        var actualJobCount = await db.JobPosts.CountAsync(j => j.CompanyId == company.Id);
                        currentSub.JobPostsUsed = actualJobCount;
                        currentSub.UpdatedAt = DateTime.UtcNow;
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

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    await next();
});

// app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseOutputCache();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
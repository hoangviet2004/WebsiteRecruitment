# TechList Backend

Hệ thống backend cho trang web tuyển dụng sinh viên IT **TechList**, xây dựng theo **Clean Architecture** với **ASP.NET Core**.

---

## Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy bạn đã cài đặt:

| Công cụ | Version | Link tải |
|---|---|---|
| .NET SDK | 9.0 trở lên | https://dotnet.microsoft.com/download |
| SQL Server | 2019 trở lên | https://www.microsoft.com/sql-server |
| SQL Server Management Studio (SSMS) | Mới nhất | https://aka.ms/ssmsfullsetup |
| Visual Studio Code | Mới nhất | https://code.visualstudio.com |
| Git | Mới nhất | https://git-scm.com |

Kiểm tra đã cài đúng chưa:
```bash
dotnet --version   # phải >= 9.0
git --version
```

---

## Cài đặt dự án

### Bước 1 — Clone repository

```bash
git clone https://github.com/hoangviet2004/WebsiteRecruitment
cd WebsiteRecruitment/backend
```

### Bước 2 — Cấu hình appsettings.json

Copy file mẫu và đổi tên:

```bash
# Windows CMD
copy src\TechList.API\appsettings.example.json src\TechList.API\appsettings.json

# Windows PowerShell / macOS / Linux
cp src/TechList.API/appsettings.example.json src/TechList.API/appsettings.json
```

Mở file `src/TechList.API/appsettings.json` và điền thông tin thực tế:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=TechListDB;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "JwtSettings": {
    "SecretKey": "đặt-chuỗi-bí-mật-tối-thiểu-32-ký-tự-ở-đây",
    "Issuer": "TechListAPI",
    "Audience": "TechListClient",
    "ExpiryMinutes": 60
  },
  "OAuth": {
    "Google": {
      "ClientId": "lấy-từ-google-cloud-console",
      "ClientSecret": "lấy-từ-google-cloud-console"
    },
    "GitHub": {
      "ClientId": "lấy-từ-github-developer-settings",
      "ClientSecret": "lấy-từ-github-developer-settings"
    }
  },
  "Cloudinary": {
    "CloudName": "lấy-từ-cloudinary-dashboard",
    "ApiKey": "lấy-từ-cloudinary-dashboard",
    "ApiSecret": "lấy-từ-cloudinary-dashboard"
  }
}
```

> ⚠️ **Lưu ý:** Không được commit file `appsettings.json` lên GitHub vì chứa thông tin nhạy cảm!

### Bước 3 — Restore các packages

```bash
dotnet restore
```

### Bước 4 — Tạo Database

Đảm bảo SQL Server đang chạy trên máy, sau đó chạy Migration:

```bash
dotnet ef database update --project src/TechList.Infrastructure --startup-project src/TechList.API
```

Nếu lệnh trên báo lỗi `dotnet-ef not found`, cài EF Tools trước:

```bash
dotnet tool install --global dotnet-ef
```

### Bước 5 — Chạy dự án

```bash
dotnet run --project src/TechList.API/TechList.API.csproj
```

Mở trình duyệt và truy cập Swagger UI:
```
https://localhost:{port}/swagger
```

---

## Cấu trúc dự án

```
backend/
├── src/
│   ├── TechList.Domain/              # Entities, Enums, Interfaces (không phụ thuộc ai)
│   ├── TechList.Application/         # Business Logic, CQRS, DTOs
│   ├── TechList.Infrastructure/      # EF Core, Identity, Services
│   └── TechList.API/                 # Controllers, Middlewares, Swagger
│
└── tests/
    ├── TechList.Domain.Tests/
    ├── TechList.Application.Tests/
    ├── TechList.Infrastructure.Tests/
    └── TechList.API.Tests/
```

---

## Danh sách Packages

### TechList.Application
| Package | Mục đích |
|---|---|
| MediatR | CQRS pattern (Commands & Queries) |
| AutoMapper | Map Entity ↔ DTO |
| FluentValidation | Validate dữ liệu đầu vào |

### TechList.Infrastructure
| Package | Mục đích |
|---|---|
| Microsoft.EntityFrameworkCore | ORM chính |
| Microsoft.EntityFrameworkCore.SqlServer | Kết nối SQL Server |
| Microsoft.EntityFrameworkCore.Tools | Chạy Migration |
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | Quản lý User/Role |
| Microsoft.AspNetCore.Authentication.JwtBearer | Xác thực JWT |
| Microsoft.IdentityModel.Tokens | Tạo/đọc JWT token |
| CloudinaryDotNet | Upload CV, ảnh |

### TechList.API
| Package | Mục đích |
|---|---|
| Swashbuckle.AspNetCore | Swagger UI |
| Microsoft.AspNetCore.Authentication.Google | Đăng nhập Google |
| AspNet.Security.OAuth.GitHub | Đăng nhập GitHub |
| Microsoft.EntityFrameworkCore.Design | Hỗ trợ chạy Migration |

---

## Lấy API Keys

### Google OAuth2
1. Vào https://console.cloud.google.com
2. Tạo project mới
3. Vào **APIs & Services** → **Credentials**
4. Tạo **OAuth 2.0 Client ID**
5. Copy `ClientId` và `ClientSecret` vào `appsettings.json`

### GitHub OAuth2
1. Vào https://github.com/settings/developers
2. Chọn **OAuth Apps** → **New OAuth App**
3. Điền thông tin, `Authorization callback URL`: `https://localhost:{port}/signin-github`
4. Copy `ClientId` và `ClientSecret` vào `appsettings.json`

### Cloudinary
1. Đăng ký tại https://cloudinary.com (có free tier)
2. Vào **Dashboard**
3. Copy `Cloud Name`, `API Key`, `API Secret` vào `appsettings.json`

---

## Các lệnh thường dùng

```bash
# Build project
dotnet build

# Chạy project
dotnet run --project src/TechList.API/TechList.API.csproj

# Chạy tests
dotnet test

# Tạo Migration mới
dotnet ef migrations add <TênMigration> --project src/TechList.Infrastructure --startup-project src/TechList.API

# Cập nhật Database
dotnet ef database update --project src/TechList.Infrastructure --startup-project src/TechList.API

# Xóa Migration gần nhất
dotnet ef migrations remove --project src/TechList.Infrastructure --startup-project src/TechList.API
```

---

## Lỗi thường gặp

**Lỗi: Cannot open database "TechListDB"**
→ Chưa chạy Migration. Thực hiện lại Bước 4.

**Lỗi: dotnet-ef not found**
→ Chạy lệnh: `dotnet tool install --global dotnet-ef`

**Lỗi: Port đang bị chiếm**
→ Chạy với port khác:
```bash
dotnet run --project src/TechList.API --urls "https://localhost:7001;http://localhost:5001"
```

**Lỗi: SSL Certificate**
```bash
dotnet dev-certs https --trust
```

---

## Công nghệ sử dụng

- **Framework:** ASP.NET Core 9.0
- **Architecture:** Clean Architecture + CQRS
- **Database:** SQL Server + Entity Framework Core
- **Authentication:** JWT + Google OAuth2 + GitHub OAuth2
- **File Storage:** Cloudinary
- **API Docs:** Swagger UI

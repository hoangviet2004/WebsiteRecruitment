# TechList

Nền tảng tuyển dụng dành cho sinh viên IT Việt Nam, bao gồm **backend** (ASP.NET Core 9.0) và **frontend** (HTML/CSS/JS thuần).

---

## Tính năng

- Đăng nhập bằng tài khoản thường (JWT), Google OAuth2, GitHub OAuth2
- Quản lý tin tuyển dụng, công ty, hồ sơ ứng viên
- Quy trình ứng tuyển: nộp CV → duyệt → phỏng vấn → kết quả
- Chat trực tiếp giữa nhà tuyển dụng và ứng viên
- Gói dịch vụ trả phí, tích hợp thanh toán VNPay
- Đánh giá CV và gợi ý việc làm bằng Gemini AI
- Thông báo real-time và gửi email tự động
- Phân quyền: Admin / Recruiter / Candidate
- Thống kê doanh thu, lượt ứng tuyển, tin đăng

---

## Yêu cầu hệ thống

| Công cụ | Phiên bản | Link tải |
|---|---|---|
| .NET SDK | 9.0+ | https://dotnet.microsoft.com/download/dotnet/9.0 |
| SQL Server | 2019+ | https://www.microsoft.com/sql-server |
| SSMS | Mới nhất | https://aka.ms/ssmsfullsetup |
| Git | Mới nhất | https://git-scm.com |

Kiểm tra:
```bash
dotnet --version   # phải >= 9.0
git --version
```

---

## Cài đặt

### Bước 1 — Clone repository

```bash
git clone https://github.com/hoangviet2004/WebsiteRecruitment
cd WebsiteRecruitment
```

### Bước 2 — Cấu hình appsettings.json

```bash
# Windows CMD
copy backend\src\TechList.API\appsettings.example.json backend\src\TechList.API\appsettings.json

# PowerShell / macOS / Linux
cp backend/src/TechList.API/appsettings.example.json backend/src/TechList.API/appsettings.json
```

Mở `backend/src/TechList.API/appsettings.json` và điền thông tin thực tế:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=TechList;Trusted_Connection=True;TrustServerCertificate=True"
  },

  "JwtSettings": {
    "SecretKey": "chuoi-bi-mat-toi-thieu-32-ky-tu-o-day",
    "Issuer": "TechListAPI",
    "Audience": "TechListClient",
    "ExpiryMinutes": 60
  },

  "OAuth": {
    "Google": {
      "ClientId": "lấy từ Google Cloud Console",
      "ClientSecret": "lấy từ Google Cloud Console"
    },
    "GitHub": {
      "ClientId": "lấy từ GitHub Developer Settings",
      "ClientSecret": "lấy từ GitHub Developer Settings"
    }
  },

  "Cloudinary": {
    "CloudName": "lấy từ Cloudinary Dashboard",
    "ApiKey": "lấy từ Cloudinary Dashboard",
    "ApiSecret": "lấy từ Cloudinary Dashboard"
  },

  "EmailSettings": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "Username": "your-email@gmail.com",
    "Password": "gmail-app-password-16-ky-tu",
    "FromName": "TechList",
    "FromEmail": "your-email@gmail.com",
    "EnableSsl": true
  },

  "Gemini": {
    "ApiKey": "lấy từ Google AI Studio",
    "Model": "gemini-2.5-flash"
  },

  "VNPay": {
    "TmnCode": "mã-merchant-vnpay",
    "HashSecret": "chuoi-bi-mat-vnpay",
    "BaseUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    "ReturnUrl": "http://localhost:5500/frontend/pages/recruiter.html"
  }
}
```

> **Lưu ý:** File `appsettings.json` đã được thêm vào `.gitignore`, không được commit lên GitHub.

### Bước 3 — Lấy API Keys

#### Google OAuth2
1. Truy cập https://console.cloud.google.com
2. Tạo project → **APIs & Services** → **Credentials**
3. Chọn **Create Credentials** → **OAuth 2.0 Client ID** → **Web application**
4. Thêm vào **Authorized redirect URIs**:
   ```
   http://localhost:5240/api/auth/google/callback
   ```
5. Copy `Client ID` và `Client Secret` vào `appsettings.json`

#### GitHub OAuth2
1. Truy cập https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Điền thông tin:
   - **Homepage URL:** `http://localhost:5240`
   - **Authorization callback URL:** `http://localhost:5240/signin-github`
3. Copy `Client ID` và `Client Secret` vào `appsettings.json`

#### Cloudinary (lưu trữ ảnh & CV)
1. Đăng ký tại https://cloudinary.com (có gói miễn phí)
2. Vào **Dashboard** → copy `Cloud Name`, `API Key`, `API Secret`

#### Gmail App Password (gửi email)
1. Bật xác minh 2 bước tại https://myaccount.google.com/security
2. Vào **App passwords** → tạo mật khẩu ứng dụng mới
3. Dán mật khẩu 16 ký tự vào `EmailSettings.Password`

#### Gemini AI (đánh giá CV & gợi ý việc làm)
1. Truy cập https://aistudio.google.com/apikey
2. Tạo API key mới → copy vào `Gemini.ApiKey`

#### VNPay (thanh toán)
1. Đăng ký tại https://sandbox.vnpayment.vn/devreg (môi trường test)
2. Lấy `TmnCode` và `HashSecret` từ trang quản trị sandbox

### Bước 4 — Khởi tạo Database

Đảm bảo SQL Server đang chạy, sau đó chạy:

```bash
cd backend

# Cài EF Tools nếu chưa có
dotnet tool install --global dotnet-ef

# Tạo database và chạy toàn bộ Migration
dotnet ef database update --project src/TechList.Infrastructure --startup-project src/TechList.API
```

> Database `TechList` sẽ được tạo tự động kèm đầy đủ schema và dữ liệu mẫu (10 công ty, 12 ứng viên, các gói dịch vụ).

### Bước 5 — Chạy dự án

**Backend:**
```bash
cd backend
dotnet run --project src/TechList.API/TechList.API.csproj
```

Backend chạy tại: `http://localhost:5240`  
Swagger UI: `http://localhost:5240/swagger`

**Frontend:**

Mở file `frontend/index.html` bằng trình duyệt hoặc dùng Live Server (VS Code extension), đảm bảo frontend chạy tại port `5500`.

---

## Cấu trúc dự án

```
WebsiteRecruitment/
├── backend/
│   ├── src/
│   │   ├── TechList.Domain/            # Entities, Enums — không phụ thuộc lớp nào
│   │   ├── TechList.Application/       # Business logic, DTOs, Validation, Mapping
│   │   ├── TechList.Infrastructure/    # EF Core, Identity, Email, Cloudinary, VNPay
│   │   └── TechList.API/              # Controllers, Middleware, Swagger, Program.cs
│   └── tests/
│       ├── TechList.Domain.Tests/
│       ├── TechList.Application.Tests/
│       ├── TechList.Infrastructure.Tests/
│       └── TechList.API.Tests/
└── frontend/
    ├── pages/                          # Các trang HTML
    ├── js/                             # Logic JavaScript
    └── assets/                         # CSS, ảnh, font
```

### API Endpoints chính

| Controller | Chức năng |
|---|---|
| `/api/auth` | Đăng ký, đăng nhập, OAuth, refresh token |
| `/api/jobs` | CRUD tin tuyển dụng |
| `/api/job-applications` | Nộp đơn, quản lý trạng thái ứng tuyển |
| `/api/profile` | Hồ sơ ứng viên, upload CV/ảnh |
| `/api/company` | Hồ sơ công ty |
| `/api/messaging` | Chat nhà tuyển dụng ↔ ứng viên |
| `/api/notifications` | Thông báo |
| `/api/packages` | Gói dịch vụ |
| `/api/payment` | Thanh toán VNPay |
| `/api/transactions` | Quản lý giao dịch (Admin) |
| `/api/cv-evaluation` | Đánh giá CV bằng Gemini AI |
| `/api/job-recommendations` | Gợi ý việc làm bằng Gemini AI |
| `/api/recruiter-statistics` | Thống kê dành cho nhà tuyển dụng |
| `/api/admin` | Quản trị hệ thống |
| `/api/saved-jobs` | Lưu tin yêu thích |
| `/api/account` | Đổi mật khẩu, cài đặt tài khoản |

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Framework | ASP.NET Core 9.0 |
| Architecture | Clean Architecture |
| ORM | Entity Framework Core 9.0 |
| Database | SQL Server 2019+ |
| Authentication | ASP.NET Core Identity + JWT Bearer |
| OAuth | Google OAuth2, GitHub OAuth2 |
| Validation | FluentValidation |
| Mapping | AutoMapper |
| Messaging pattern | MediatR |
| File storage | Cloudinary |
| Email | MailKit (Gmail SMTP) |
| Payment | VNPay |
| AI | Google Gemini API |
| PDF parsing | PdfPig |
| API docs | Swagger (Swashbuckle) |
| Testing | xUnit, Moq, FluentAssertions |

---

## Các lệnh thường dùng

```bash
# Build
dotnet build

# Chạy backend
dotnet run --project backend/src/TechList.API/TechList.API.csproj

# Chạy tests
dotnet test

# Tạo Migration mới
dotnet ef migrations add <TênMigration> \
  --project backend/src/TechList.Infrastructure \
  --startup-project backend/src/TechList.API

# Cập nhật Database
dotnet ef database update \
  --project backend/src/TechList.Infrastructure \
  --startup-project backend/src/TechList.API

# Xóa Migration gần nhất
dotnet ef migrations remove \
  --project backend/src/TechList.Infrastructure \
  --startup-project backend/src/TechList.API
```

---

## Lỗi thường gặp

**`Cannot open database "TechList"`**  
→ Chưa chạy Migration. Thực hiện lại Bước 4.

**`dotnet-ef: command not found`**  
→ Chạy: `dotnet tool install --global dotnet-ef`

**`Port 5240 already in use`**  
→ Chạy với port khác:
```bash
dotnet run --project backend/src/TechList.API --urls "http://localhost:5001"
```
Sau đó cập nhật `API_URL` trong `frontend/js/api.js` cho khớp.

**`SSL Certificate not trusted`**  
```bash
dotnet dev-certs https --trust
```

**Đăng nhập Google/GitHub báo lỗi redirect**  
→ Kiểm tra lại Authorized redirect URI trong Google Cloud Console / GitHub OAuth App có khớp với port đang chạy không.

---

## Liên hệ

Nếu gặp vấn đề trong quá trình cài đặt, tạo **Issue** trên GitHub hoặc liên hệ: `viet16092004@gmail.com`

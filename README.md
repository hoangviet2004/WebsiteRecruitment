# TechList Backend

Hệ thống backend mạnh mẽ cho nền tảng tuyển dụng sinh viên IT **TechList**, được xây dựng theo kiến trúc **Clean Architecture** sử dụng **ASP.NET Core 9.0**. Dự án tập trung vào tính mở rộng, bảo mật và hiệu năng cao.

---

## 🌟 Tính năng chính

- **Xác thực đa phương thức**: Hỗ trợ đăng nhập truyền thống (JWT), Google OAuth2 và GitHub OAuth2.
- **Quản lý Việc làm & Công ty**: Hệ thống tin tuyển dụng và hồ sơ công ty chuyên sâu, hỗ trợ phân cấp nổi bật (Gold/Silver/Basic).
- **Quy trình Ứng tuyển**: Ứng viên nộp CV, nhà tuyển dụng quản lý trạng thái hồ sơ (Applied, Screening, Interview, Offered...).
- **Hệ thống Tin nhắn (Messaging)**: Chat trực tiếp giữa Nhà tuyển dụng và Ứng viên dựa trên từng đơn ứng tuyển.
- **Gói dịch vụ & Thanh toán**: Tích hợp cổng thanh toán **VnPay** để nhà tuyển dụng mua các gói dịch vụ cao cấp.
- **Phân quyền (RBAC)**: Phân quyền chặt chẽ giữa Admin, Recruiter và Candidate.
- **Hệ thống Báo cáo**: Thống kê số lượng tin đăng, ứng tuyển và doanh thu (dành cho Admin và Recruiter).

---

## 🛠️ Yêu cầu hệ thống

Đảm bảo môi trường phát triển của bạn đã cài đặt các công cụ sau:

| Công cụ | Version | Link tải |
|---|---|---|
| **.NET SDK** | 9.0+ | [Download .NET 9](https://dotnet.microsoft.com/download/dotnet/9.0) |
| **SQL Server** | 2019+ | [Download SQL Server](https://www.microsoft.com/sql-server) |
| **SSMS / Azure Data Studio** | Mới nhất | [Download SSMS](https://aka.ms/ssmsfullsetup) |
| **Git** | Mới nhất | [Download Git](https://git-scm.com) |

Kiểm tra cài đặt:
```bash
dotnet --version   # Output: 9.0.x
git --version
```

---

## 🚀 Hướng dẫn cài đặt

### Bước 1: Clone Repository
```bash
git clone https://github.com/hoangviet2004/WebsiteRecruitment
cd WebsiteRecruitment/backend
```

### Bước 2: Cấu hình `appsettings.json`
Copy file mẫu và đổi tên thành `appsettings.json`:
```bash
# PowerShell
cp src/TechList.API/appsettings.example.json src/TechList.API/appsettings.json
```

Mở file và cập nhật các thông tin cấu hình thực tế:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=YOUR_SERVER;Database=TechListDB;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "JwtSettings": {
    "SecretKey": "chuoi-bi-mat-dai-tren-32-ky-tu",
    "Issuer": "TechListAPI",
    "Audience": "TechListClient"
  },
  "OAuth": {
    "Google": { "ClientId": "...", "ClientSecret": "..." },
    "GitHub": { "ClientId": "...", "ClientSecret": "..." }
  },
  "Cloudinary": {
    "CloudName": "...", "ApiKey": "...", "ApiSecret": "..."
  },
  "VNPay": {
    "TmnCode": "YOUR_TMN_CODE",
    "HashSecret": "YOUR_HASH_SECRET",
    "BaseUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    "ReturnUrl": "http://localhost:5500/frontend/pages/payment-callback.html"
  }
}
```

### Bước 3: Khởi tạo Database
Dự án sử dụng EF Core Migrations. Hãy đảm bảo SQL Server đang chạy:
```bash
# Di chuyển vào thư mục backend nếu chưa có
dotnet ef database update --project src/TechList.Infrastructure --startup-project src/TechList.API
```

### Bước 4: Chạy dự án
```bash
dotnet run --project src/TechList.API/TechList.API.csproj
```
Dự án sẽ mặc định chạy tại: `https://localhost:7191` hoặc `http://localhost:5240` (Tùy cấu hình `launchSettings.json`).

---

## 🏗️ Cấu trúc dự án (Clean Architecture)

Dự án được chia thành 4 lớp chính nhằm tách biệt logic và tăng khả năng bảo trì:

1. **TechList.Domain**: Chứa các Entity, Enum, Exceptions và các interface cốt lõi. Không phụ thuộc vào bất kỳ lớp nào khác.
2. **TechList.Application**: Chứa Business Logic, DTOs, Mapping (AutoMapper), Validation (FluentValidation).
3. **TechList.Infrastructure**: Triển khai các dịch vụ ngoại vi: EF Core (Persistence), Identity, Cloudinary, VnPay, Email...
4. **TechList.API**: Điểm đầu vào của hệ thống, chứa Controllers, Middlewares và cấu hình Swagger.

---

## 📚 Công nghệ sử dụng

- **Backend Framework**: ASP.NET Core 9.0
- **ORM**: Entity Framework Core
- **Database**: SQL Server
- **Identity & Security**: ASP.NET Core Identity + JWT Bearer
- **API Documentation**: Swagger (Swashbuckle)
- **Object Mapping**: AutoMapper
- **Validation**: FluentValidation
- **Cloud Storage**: Cloudinary (lưu trữ ảnh thẻ, CV)
- **Payment Gateway**: VnPay API
- **Architecture Patterns**: Dependency Injection, Repository Pattern, Middleware.

---

## 🛠️ Lệnh thường dùng

| Lệnh | Mô tả |
|---|---|
| `dotnet build` | Biên dịch toàn bộ dự án |
| `dotnet test` | Chạy các unit test |
| `dotnet ef migrations add <Name>` | Tạo một Migration mới |
| `dotnet ef database update` | Cập nhật cấu trúc DB hiện tại |
| `dotnet dev-certs https --trust` | Tin cậy chứng chỉ SSL cục bộ |

---

## 🤝 Thông tin liên hệ
Nếu bạn gặp khó khăn trong quá trình cài đặt hoặc phát hiện lỗi, vui lòng tạo **Issue** trên GitHub hoặc liên hệ qua email: `viet16092004@gmail.com`.

---
*TechList - Kiến tạo tương lai cho sinh viên IT Việt Nam.*

UPDATE [ServicePackages]
SET [Features] = N'["3 tin tuyển dụng/tháng","Hiển thị cơ bản","Hỗ trợ qua email"]'
WHERE [Name] = N'Free';

UPDATE [ServicePackages]
SET [Features] = N'["10 tin tuyển dụng/tháng","Hiển thị ưu tiên","Xem hồ sơ ứng viên","Hỗ trợ qua email và chat"]'
WHERE [Name] = N'Basic';

UPDATE [ServicePackages]
SET [Features] = N'["30 tin tuyển dụng/tháng","Hiển thị nổi bật","Xem & tải hồ sơ ứng viên","Thống kê chi tiết","Hỗ trợ ưu tiên 24/7"]'
WHERE [Name] = N'Pro';

UPDATE [ServicePackages]
SET [Features] = N'["Không giới hạn tin tuyển dụng","Hiển thị VIP trên trang chủ","Toàn quyền xem hồ sơ ứng viên","Thống kê nâng cao","Tài khoản quản lý đa người dùng","Hỗ trợ chuyên viên riêng"]'
WHERE [Name] = N'Premium';

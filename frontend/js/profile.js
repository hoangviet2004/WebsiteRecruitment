// ============================================================
// profile.js - Xử lý logic cho trang cấu hình hồ sơ cá nhân
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const form = document.getElementById('profile-form');
    const btnSave = document.querySelector('.btn-save');
    
    // Thuộc tính avatar
    const avatarInput = document.getElementById('avatar-input');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarLoading = document.getElementById('avatar-loading');

    // 1. Lấy thông tin mặc định có sẵn từ hệ thống
    const currentUser = getCurrentUser(); // từ api.js
    
    // Tạm thời lấy các thông tin chưa có trong DB từ localStorage (Email tự chỉnh, Phone)
    const userKey = currentUser.email || 'guest';
    emailInput.value = localStorage.getItem(`profile_email_${userKey}`) || currentUser.email || '';
    phoneInput.value = localStorage.getItem(`profile_phone_${userKey}`) || '';

    // Khóa email nếu đăng nhập bằng Google/Github (không cho sửa)
    if (sessionStorage.getItem("loginProvider") === "oauth") {
        emailInput.readOnly = true;
        emailInput.style.backgroundColor = '#f3f4f6';
        emailInput.style.cursor = 'not-allowed';
        emailInput.title = 'Bạn không thể thay đổi email khi đăng nhập bằng Google hoặc GitHub';
    }

    // 2. Gọi API để lấy thông tin Profile mới nhất từ backend (Họ và tên, môt tả, avatar...)
    try {
        const res = await apiFetchAuth('/api/profile/me', { method: 'GET' });
        if (res && res.ok) {
            const dataResponse = await res.json();
            const profile = dataResponse.data;
            if (profile) {
                // Hiển thị tên từ DB nếu có, không thì lấy từ sessionStorage login
                fullNameInput.value = profile.displayName || currentUser.fullName || '';
                
                // Hiển thị avatar
                const displayNameForAvatar = profile.displayName || currentUser.fullName || 'User';
                if (profile.avatarUrl) {
                    avatarPreview.src = profile.avatarUrl;
                    sessionStorage.setItem('avatarUrl', profile.avatarUrl);
                    if (typeof renderNavRight === 'function') renderNavRight();
                } else {
                    avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNameForAvatar)}&background=3b82f6&color=fff&size=150`;
                }
            }
        }
    } catch (e) {
        console.error("Không thể lấy dữ liệu profile từ server:", e);
        fullNameInput.value = currentUser.fullName || '';
    }

    // 3. Lắng nghe sự kiện Submit (Lưu thay đổi)
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Ngăn trình duyệt tải lại trang

        const newName = fullNameInput.value.trim();
        const newEmail = emailInput.value.trim();
        const newPhone = phoneInput.value.trim();

        if (!newName) {
            alert('Vui lòng nhập họ và tên!');
            return;
        }

        const originalBtnText = btnSave.textContent;
        btnSave.textContent = 'Đang lưu...';
        btnSave.disabled = true;

        try {
            // Gửi API cập nhật Profile (Hiện backend đang hỗ trợ DisplayName và Bio)
            const res = await apiFetchAuth('/api/profile/me', {
                method: 'PUT',
                body: JSON.stringify({ 
                    displayName: newName, 
                    bio: '' // Hiện tại mình chưa có input mô tả nên truyền rỗng hoặc string cũ
                })
            });

            if (res && res.ok) {
                // Lưu thành công
                // Đồng bộ ngược lại vào Session và Local storage để các trang khác (như homebar) nhận diện được tên mới
                sessionStorage.setItem('fullName', newName); // Cập nhật tên trong phiên hiện tại
                const userKey = currentUser.email || 'guest';
                localStorage.setItem(`profile_email_${userKey}`, newEmail);
                localStorage.setItem(`profile_phone_${userKey}`, newPhone);

                alert('Cập nhật thông tin thành công!');

                // Cập nhật lại thanh điều hướng (nếu có sử dụng renderNavRight từ home.js)
                if (typeof renderNavRight === 'function') {
                    renderNavRight();
                }
            } else {
                alert('Có lỗi xảy ra khi cập nhật trên server.');
            }
        } catch (error) {
            console.error('Lỗi khi lưu profile:', error);
            alert('Cập nhật thất bại, vui lòng thử lại.');
        } finally {
            btnSave.textContent = originalBtnText;
            btnSave.disabled = false;
        }
    });

    // 4. Logic thay đổi ảnh đại diện (Tự động tải lên ngay khi chọn ảnh)
    if (avatarInput) {
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // 1) Tạo luồng hiển thị trước avatar cho người dùng thấy nhanh
            const reader = new FileReader();
            reader.onload = (ev) => {
                avatarPreview.src = ev.target.result;
            };
            reader.readAsDataURL(file);

            // 2) Bắt đầu gọi API Upload Image
            avatarLoading.style.display = 'block';

            const formData = new FormData();
            formData.append('file', file);

            try {
                // Chúng ta tự tạo fetch vì apiFetchAuth hiện bị gán ứng với json không gửi được FormData dễ dàng
                const baseToken = sessionStorage.getItem('token');
                if (!baseToken) {
                    alert('Bạn chưa đăng nhập!');
                    return;
                }

                const response = await fetch(`${API_URL}/api/profile/avatar`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${baseToken}`
                    },
                    body: formData // Form data tự sinh Boundary
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.data && result.data.avatarUrl) {
                        // Nhận lại link cloud từ api trả về
                        avatarPreview.src = result.data.avatarUrl;
                        sessionStorage.setItem('avatarUrl', result.data.avatarUrl);
                        if (typeof renderNavRight === 'function') renderNavRight();
                        
                        alert('Cập nhật ảnh đại diện thành công!');
                    }
                } else {
                    const errText = await response.text();
                    console.error('Server response:', response.status, errText);
                    alert(`Đã xảy ra lỗi khi tải ảnh lên (Mã lỗi ${response.status}).\n\nChi tiết: ${errText}`);
                }
            } catch (error) {
                console.error('Lỗi upload avatar:', error);
                alert('Tải ảnh thất bại, vui lòng thử lại.');
            } finally {
                avatarLoading.style.display = 'none';
                avatarInput.value = ''; // Reset file input để có thể chọn lại đúng file đó lần nữa
            }
        });
    }
});

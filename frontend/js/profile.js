// ============================================================
// profile.js - Xử lý logic cho trang cấu hình hồ sơ cá nhân
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const form = document.getElementById('profile-form');
    const btnSave = document.querySelector('.btn-save');

    // 1. Lấy thông tin mặc định có sẵn từ hệ thống
    const currentUser = getCurrentUser(); // từ api.js
    
    // Tạm thời lấy các thông tin chưa có trong DB từ localStorage (Email tự chỉnh, Phone)
    emailInput.value = localStorage.getItem('profile_email') || currentUser.email || '';
    phoneInput.value = localStorage.getItem('profile_phone') || '';

    // 2. Gọi API để lấy thông tin Profile mới nhất từ backend (Họ và tên, môt tả, avatar...)
    try {
        const res = await apiFetchAuth('/api/profile/me', { method: 'GET' });
        if (res && res.ok) {
            const dataResponse = await res.json();
            const profile = dataResponse.data;
            if (profile) {
                // Hiển thị tên từ DB nếu có, không thì lấy từ sessionStorage login
                fullNameInput.value = profile.displayName || currentUser.fullName || '';
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
                localStorage.setItem('profile_email', newEmail);
                localStorage.setItem('profile_phone', newPhone);

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
});

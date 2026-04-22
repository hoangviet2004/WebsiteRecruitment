// ============================================================
// profile.js - Xử lý logic cho trang cấu hình hồ sơ cá nhân
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const fullNameInput = document.getElementById('fullName');
    const emailInput    = document.getElementById('email');
    const phoneInput    = document.getElementById('phone');
    const bioInput      = document.getElementById('bio');
    const bioCountEl    = document.getElementById('bio-count');
    const bioCounter    = bioInput?.closest('.form-group')?.querySelector('.bio-counter');
    const form    = document.getElementById('profile-form');
    const btnSave = document.querySelector('.btn-save');
    
    // Thuộc tính avatar
    const avatarInput   = document.getElementById('avatar-input');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarLoading = document.getElementById('avatar-loading');

    // Bộ đếm ký tự Bio (định nghĩa sớm để dùng khi load API)
    function updateBioCounter() {
        if (!bioInput || !bioCountEl || !bioCounter) return;
        const len = bioInput.value.length;
        bioCountEl.textContent = len;
        bioCounter.classList.remove('warn', 'limit');
        if (len >= 500) bioCounter.classList.add('limit');
        else if (len >= 400) bioCounter.classList.add('warn');
    }

    if (bioInput) {
        bioInput.addEventListener('input', updateBioCounter);
    }

    // 1. Lấy thông tin mặc định có sẵn từ hệ thống
    const currentUser = getCurrentUser(); // từ api.js
    // Sử dụng thông tin email thực tế từ JWT token (không dùng chung qua localStorage)
    emailInput.value = currentUser.email || '';
    emailInput.readOnly = true; // Email không thay đổi qua form này
    emailInput.style.backgroundColor = '#f8fafc';
    
    const phoneStorageKey = 'profile_phone_' + (currentUser.email || 'guest');
    phoneInput.value = localStorage.getItem(phoneStorageKey) || '';

    // 2. Gọi API để lấy thông tin Profile mới nhất từ backend (Họ và tên, môt tả, avatar...)
    try {
        const res = await apiFetchAuth('/api/profile/me', { method: 'GET' });
        if (res && res.ok) {
            const dataResponse = await res.json();
            const profile = dataResponse.data;
            if (profile) {
                // Hiển thị tên từ DB nếu có, không thì lấy từ sessionStorage login
                fullNameInput.value = profile.displayName || currentUser.fullName || '';

                // Điền bio
                if (bioInput) {
                    bioInput.value = profile.bio || '';
                    updateBioCounter();
                }

                const skillsInput = document.getElementById('skills');
                if (skillsInput) skillsInput.value = profile.skills || '';
                
                const experienceInput = document.getElementById('experience');
                if (experienceInput) experienceInput.value = profile.experience || '';

                if (profile.cvUrl) {
                    const cvEmpty = document.getElementById('cv-empty');
                    const cvPreview = document.getElementById('cv-preview');
                    const cvLink = document.getElementById('cv-link');
                    if (cvEmpty && cvPreview && cvLink) {
                        cvEmpty.style.display = 'none';
                        cvPreview.style.display = 'flex';
                        cvLink.href = profile.cvUrl;
                    }
                }

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

        const newName  = fullNameInput.value.trim();
        const newEmail = emailInput.value.trim();
        const newPhone = phoneInput.value.trim();
        const newBio   = bioInput ? bioInput.value.trim() : '';
        const newSkills = document.getElementById('skills') ? document.getElementById('skills').value.trim() : '';
        const newExperience = document.getElementById('experience') ? document.getElementById('experience').value.trim() : '';

        if (!newName) {
            alert('Vui lòng nhập họ và tên!');
            return;
        }

        if (newBio.length > 500) {
            alert('Giới thiệu bản thân không được vượt quá 500 ký tự!');
            bioInput.focus();
            return;
        }

        const originalBtnText = btnSave.textContent;
        btnSave.textContent = 'Đang lưu...';
        btnSave.disabled = true;

        try {
            // Gửi API cập nhật Profile (DisplayName và Bio)
            const res = await apiFetchAuth('/api/profile/me', {
                method: 'PUT',
                body: JSON.stringify({ 
                    displayName: newName, 
                    bio: newBio,
                    skills: newSkills,
                    experience: newExperience
                })
            });

            if (res && res.ok) {
                // Đồng bộ ngược lại vào Session để các trang khác (như homebar) nhận diện được tên mới
                sessionStorage.setItem('fullName', newName); // Cập nhật tên trong phiên hiện tại
                
                const phoneStorageKey = 'profile_phone_' + (currentUser.email || 'guest');
                localStorage.setItem(phoneStorageKey, newPhone);

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

    // 5. Logic thay đổi CV (Upload PDF)
    const cvInput = document.getElementById('cv-input');
    const cvLoading = document.getElementById('cv-loading');
    const cvEmpty = document.getElementById('cv-empty');
    const cvPreview = document.getElementById('cv-preview');
    const cvLink = document.getElementById('cv-link');

    if (cvInput) {
        cvInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.type !== 'application/pdf') {
                alert('Vui lòng chọn file định dạng PDF!');
                cvInput.value = '';
                return;
            }

            if (cvLoading) cvLoading.style.display = 'block';
            if (cvEmpty) cvEmpty.style.display = 'none';
            if (cvPreview) cvPreview.style.display = 'none';

            const formData = new FormData();
            formData.append('file', file);

            try {
                const baseToken = sessionStorage.getItem('token');
                if (!baseToken) {
                    alert('Bạn chưa đăng nhập!');
                    return;
                }

                const response = await fetch(`${API_URL}/api/profile/cv`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${baseToken}`
                    },
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.data && result.data.cvUrl) {
                        if (cvLink) cvLink.href = result.data.cvUrl;
                        if (cvPreview) cvPreview.style.display = 'flex';
                        alert('Tải lên CV thành công!');
                    }
                } else {
                    const errText = await response.text();
                    console.error('Server response:', response.status, errText);
                    alert(`Đã xảy ra lỗi khi tải CV lên.\n\nChi tiết: ${errText}`);
                    if (cvEmpty) cvEmpty.style.display = 'block';
                }
            } catch (error) {
                console.error('Lỗi upload CV:', error);
                alert('Tải CV thất bại, vui lòng thử lại.');
                if (cvEmpty) cvEmpty.style.display = 'block';
            } finally {
                if (cvLoading) cvLoading.style.display = 'none';
                cvInput.value = '';
            }
        });
    }
});

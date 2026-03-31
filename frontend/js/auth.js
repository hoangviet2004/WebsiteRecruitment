// Chuyển panel
function showPanel(name) {
    document.getElementById("panel-register").style.display = "none";
    document.getElementById("panel-login").style.display = "none";
    document.getElementById("panel-forgot").style.display = "none";

    document.getElementById("panel-" + name).style.display = "block";

    var subtitles = {
        register: "Tìm kiếm công việc mơ ước của bạn",
        login: "Chào mừng trở lại!",
        forgot: "Đặt lại mật khẩu"
    };
    document.getElementById("subtitle").textContent = subtitles[name];
}

// Toggle hiện/ẩn mật khẩu
function togglePassword(id) {
    var input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}

// Đăng ký
document.getElementById("registerForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    var fullName = document.getElementById("reg-fullname").value.trim();
    var email    = document.getElementById("reg-email").value.trim().toLowerCase();
    var role     = document.getElementById("reg-role").value;
    var pass     = document.getElementById("reg-password").value;
    var confirm  = document.getElementById("reg-confirm").value;

    if (pass.length < 8) {
        alert("Mật khẩu phải có ít nhất 8 ký tự!");
        return;
    }
    if (pass !== confirm) {
        alert("Mật khẩu không khớp!");
        return;
    }

    try {
        var response = await apiFetch("/api/Auth/register", {
            method: "POST",
            body: JSON.stringify({
                DisplayName: fullName,
                Email: email,
                Password: pass,
                Role: role
            })
        });

        var data = null;
        try { data = await response.json(); } catch (_) {}

        if (response.ok) {
            alert(data?.message || "Đăng ký thành công!");
            document.getElementById("login-email").value = email;
            showPanel("login");
            return;
        }

        var msg =
            data?.message ||
            (Array.isArray(data?.errors) ? data.errors.map(function(e) { return e.error || e; }).join(", ") : null) ||
            `Đăng ký thất bại (HTTP ${response.status})`;
        alert(msg);
    } catch (err) {
        console.error("Đăng ký lỗi:", err);
        alert("Không thể kết nối server để đăng ký!");
    }
});

// Đăng nhập
document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    var email    = document.getElementById("login-email").value.trim().toLowerCase();
    var password = document.getElementById("login-password").value;

    try {
        var response = await apiFetch("/api/Auth/login", {
            method: "POST",
            body: JSON.stringify({
                Email: email,
                Password: password
            })
        });

        var data = null;
        try { data = await response.json(); } catch (_) {}

        if (response.ok) {
            const payload = data?.data;
            const accessToken = payload?.tokens?.accessToken;
            const refreshToken = payload?.tokens?.refreshToken;
            const user = payload?.user;

            localStorage.setItem("token", accessToken || "");
            localStorage.setItem("refreshToken", refreshToken || "");
            localStorage.setItem("fullName", user?.displayName || "");
            localStorage.setItem("email", user?.email || "");
            localStorage.setItem("role", (user?.roles || [])[0] || "");

            window.location.href = "../pages/home.html";
            return;
        }

        var msg = data?.message || `Đăng nhập thất bại (HTTP ${response.status})`;
        alert(msg);
    } catch (err) {
        console.error("Đăng nhập lỗi:", err);
        alert("Không thể kết nối server để đăng nhập!");
    }
});

// Quên mật khẩu
document.getElementById("forgotForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Đã gửi email đặt lại mật khẩu!");
});

// Đọc hash từ URL (khi từ trang home chuyển sang)
var hash = window.location.hash.replace("#", "");
if (hash === "login" || hash === "register" || hash === "forgot") {
    showPanel(hash);
}
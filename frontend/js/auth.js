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

// Validate đăng ký
document.getElementById("registerForm").addEventListener("submit", function(e) {
    e.preventDefault();
    var pass    = document.getElementById("reg-password").value;
    var confirm = document.getElementById("reg-confirm").value;

    if (pass.length < 8) {
        alert("Mật khẩu phải có ít nhất 8 ký tự!");
        return;
    }
    if (pass !== confirm) {
        alert("Mật khẩu không khớp!");
        return;
    }
    alert("Đăng ký thành công!");
});

// Validate đăng nhập
document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Đăng nhập thành công!");
});

// Quên mật khẩu
document.getElementById("forgotForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Đã gửi email đặt lại mật khẩu!");
});

// Đọc hash từ URL (khi từ trang home chuyển sang)
var hash = window.location.hash.replace("#", "");
if (hash === "login" || hash === "forgot") {
    showPanel(hash);
}
function loadSidebar() {
  fetch('../components/sidebar.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('sidebar-container').innerHTML = data;
    });
}

function go(path) {
  window.location.href = path;
}

function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("fullName");
  sessionStorage.removeItem("email");
  sessionStorage.removeItem("role");
  window.location.href = "../pages/auth.html";
}
function loadSidebar() {
  fetch('/components/sidebar.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('sidebar-container').innerHTML = data;
    });
}

function go(path) {
  window.location.href = path;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("fullName");
  localStorage.removeItem("email");
  localStorage.removeItem("role");
  window.location.href = "../pages/auth.html";
}
function loadSidebar() {
  fetch('../components/sidebar.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('sidebar-container').innerHTML = data;
      highlightActivePage();
    });
}

function go(path) {
  window.location.href = path;
}

function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("userId");
  sessionStorage.removeItem("fullName");
  sessionStorage.removeItem("email");
  sessionStorage.removeItem("role");
  window.location.href = "../pages/auth.html";
}

function highlightActivePage() {
  const currentPage = window.location.pathname.split('/').pop();
  const sidebarItems = document.querySelectorAll('.sidebar .nav-item');
  
  sidebarItems.forEach(item => {
    const href = item.getAttribute('data-page');
    if (href && currentPage === href) {
      item.classList.add('active');
    }
  });
}
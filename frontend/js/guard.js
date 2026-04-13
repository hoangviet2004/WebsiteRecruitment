function requireAdmin() {
  const role = localStorage.getItem("role");

  if (!role || role.toLowerCase() !== "admin") {
    window.location.href = "../pages/auth.html";
  }
}
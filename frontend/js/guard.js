function requireAdmin() {
  const role = sessionStorage.getItem("role");

  if (!role || role.toLowerCase() !== "admin") {
    window.location.href = "../pages/auth.html";
  }
}
// Cargar header
const container = document.getElementById("admin-header");

async function loadAdminHeader() {
  const res = await fetch("/admin/components/admin-header.html");
  const html = await res.text();
  container.innerHTML = html;

  activateNavCurrentPage();
  setupUserMenu();
}

loadAdminHeader();

// ==========================================================
// 1. Resaltar el enlace activo según la URL
// ==========================================================
function activateNavCurrentPage() {
  const path = window.location.pathname.toLowerCase();

  document.querySelectorAll(".admin-nav .nav-link").forEach(link => {
    if (path.includes(link.dataset.page)) {
      link.classList.add("nav-link--active");
    }
  });
}

// ==========================================================
// 2. Menú usuario (dropdown) + Logout
// ==========================================================
function setupUserMenu() {
  const toggle = document.getElementById("admin-user-toggle");
  const dropdown = document.getElementById("admin-user-dropdown");
  const logoutBtn = document.getElementById("admin-logout-btn");

  toggle.onclick = () => {
    dropdown.classList.toggle("admin-user-dropdown--hidden");
  };

  logoutBtn.onclick = async () => {
    await window.supabase.auth.signOut();
    window.location.href = "/login.html";
  };
}

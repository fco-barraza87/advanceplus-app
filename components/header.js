// /components/header.js

import { getCurrentUserWithProfile, logout } from "/js/auth.js";
import { redirectByRole } from "/js/router.js";

/* ============================================================
   HEADER ADVANCE+ · V2 PREMIUM
   Modular, seguro, con roles y resaltado activo
============================================================ */

export async function loadHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  // Obtener sesión + perfil
  const data = await getCurrentUserWithProfile();

  if (!data) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { profile } = data;

  const fullName = profile.full_name ?? "Usuario";
  const avatar = profile.avatar_url ?? "/img/default-avatar.png";
  const role = profile.role ?? "user";

  // Obtener ruta actual para resaltar el ítem correcto
  const currentPath = window.location.pathname;

  /* ------------------------------------------------------------
     NAVIGACIÓN POR ROL
  ------------------------------------------------------------ */

  const navUser = [
    { label: "Inicio", url: "/dashboard/index.html" },
    { label: "Mis Cursos", url: "/curso/index.html" },
    { label: "Perfil", url: "/perfil/index.html" },
  ];

  const navCoach = [
    { label: "Panel Coach", url: "/dashboard/coach.html" },
    { label: "Perfil", url: "/perfil/index.html" },
  ];

  const navAdmin = [
    { label: "Admin", url: "/dashboard/admin.html" },
    { label: "Coach", url: "/dashboard/coach.html" },
    { label: "Perfil", url: "/perfil/index.html" },
  ];

  const menus = {
    user: navUser,
    coach: navCoach,
    admin: navAdmin,
  };

  const navItems = menus[role]
    .map((item) => {
      const isActive = currentPath.includes(item.url) ? "active-link" : "";
      return `<a href="${item.url}" class="${isActive}">${item.label}</a>`;
    })
    .join("");

  /* ------------------------------------------------------------
     HEADER FINAL
  ------------------------------------------------------------ */

  container.innerHTML = `
    <header class="ap-header">

      <!-- LOGO A+ -->
      <div class="ap-header-left" onclick="window.location.href='/dashboard/index.html'">
        <h1 class="ap-logo">A+</h1>
      </div>

      <!-- MENÚ -->
      <nav class="ap-nav">
        ${navItems}
      </nav>

      <!-- DROPDOWN PERFIL -->
      <div class="ap-header-right">
        <div class="ap-user-menu">
          <img src="${avatar}" class="ap-avatar" id="apAvatarBtn" />

          <div class="ap-dropdown" id="apDropdown">
            <p class="ap-user-name">${fullName}</p>
            <button id="logoutBtn" class="ap-logout-btn">Cerrar sesión</button>
          </div>
        </div>
      </div>

    </header>
  `;

  /* ------------------------------------------------------------
     EVENTOS DEL HEADER
  ------------------------------------------------------------ */

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // Toggle dropdown
  const avatarBtn = document.getElementById("apAvatarBtn");
  const dropdown = document.getElementById("apDropdown");

  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("show");
  });

  // Cerrar si haces click fuera
  document.addEventListener("click", () => dropdown.classList.remove("show"));
}

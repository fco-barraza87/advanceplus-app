// /components/header.js

import { getCurrentUserWithProfile, logout } from "/js/auth.js";
import { redirectByRole } from "/js/router.js";

/* ============================================================
   HEADER PRINCIPAL ADVANCE+
============================================================ */
export async function loadHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  const data = await getCurrentUserWithProfile();

  // Si no hay usuario → enviamos al login
  if (!data) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { profile } = data;

  const fullName = profile.full_name ?? "Usuario";
  const avatar = profile.avatar_url ?? "/img/default-avatar.png";
  const role = profile.role ?? "user";

  container.innerHTML = `
    <header class="ap-header">

      <!-- LOGO -->
      <div class="ap-header-left" onclick="window.location.href='/dashboard/index.html'">
        <h1 class="ap-logo">A+</h1>
      </div>

      <!-- MENÚ DE NAVEGACIÓN (depende del rol) -->
      <nav class="ap-nav">
        ${role === "user" ? `
          <a href="/dashboard/index.html">Inicio</a>
          <a href="/curso/index.html">Mis Cursos</a>
          <a href="/perfil/index.html">Perfil</a>
        ` : ""}

        ${role === "coach" ? `
          <a href="/dashboard/coach.html">Panel Coach</a>
          <a href="/perfil/index.html">Perfil</a>
        ` : ""}

        ${role === "admin" ? `
          <a href="/dashboard/admin.html">Admin</a>
          <a href="/dashboard/coach.html">Coach</a>
          <a href="/perfil/index.html">Perfil</a>
        ` : ""}
      </nav>

      <!-- PERFIL / AVATAR -->
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

  // EVENTOS
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // Menú desplegable avatar
  const avatarBtn = document.getElementById("apAvatarBtn");
  const dropdown = document.getElementById("apDropdown");

  avatarBtn.addEventListener("click", () => {
    dropdown.classList.toggle("show");
  });

  window.addEventListener("click", (e) => {
    if (!avatarBtn.contains(e.target)) dropdown.classList.remove("show");
  });
}

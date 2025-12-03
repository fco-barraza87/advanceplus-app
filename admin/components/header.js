// ===============================================================
//  HEADER ADMIN — CARGA DINÁMICA
// ===============================================================

import { supabase } from "/js/supabase.js";

async function loadAdminHeader() {
  const container = document.getElementById("admin-header");
  if (!container) return;

  // 1. Cargar archivo header.html
  const res = await fetch("/admin/components/header.html");
  const html = await res.text();
  container.innerHTML = html;

  // 2. Activar navegación según URL
  highlightActiveLink();

  // 3. Cargar rol del admin
  await loadAdminRole();

  // 4. Activar menú usuario
  attachUserMenuEvents();

  // 5. Activar logout
  attachLogoutEvent();
}

// ===============================================================
//  HIGHLIGHT ACTIVE PAGE
// ===============================================================
function highlightActiveLink() {
  const path = window.location.pathname.toLowerCase();

  document.querySelectorAll(".admin-nav .nav-link").forEach(link => {
    const slug = link.dataset.page.toLowerCase();
    if (path.includes(slug)) {
      link.classList.add("nav-link--active");
    }
  });
}

// ===============================================================
//  LOAD CURRENT ADMIN ROLE
// ===============================================================
async function loadAdminRole() {
  const { data: { session } } = await supabase.auth.getSession();
  const pill = document.getElementById("admin-role-pill");

  if (!session || !pill) {
    pill.textContent = "Sin sesión";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    pill.textContent = "Error";
    return;
  }

  pill.classList.remove("role-pill--admin", "role-pill--coach");

  if (profile.role === "admin") {
    pill.textContent = "Admin";
    pill.classList.add("role-pill--admin");
  } else if (profile.role === "coach") {
    pill.textContent = "Coach";
    pill.classList.add("role-pill--coach");
  } else {
    pill.textContent = profile.role;
  }
}

// ===============================================================
//  USER MENU DROPDOWN
// ===============================================================
function attachUserMenuEvents() {
  const toggle = document.getElementById("admin-user-toggle");
  const dropdown = document.getElementById("admin-user-dropdown");

  if (!toggle || !dropdown) return;

  toggle.addEventListener("click", () => {
    dropdown.classList.toggle("admin-user-dropdown--hidden");
  });

  // Cerrar al clicar fuera
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && !toggle.contains(e.target)) {
      dropdown.classList.add("admin-user-dropdown--hidden");
    }
  });
}

// ===============================================================
//  LOGOUT
// ===============================================================
function attachLogoutEvent() {
  const btn = document.getElementById("admin-logout-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });
}

// ===============================================================
//  INICIAR
// ===============================================================
loadAdminHeader();

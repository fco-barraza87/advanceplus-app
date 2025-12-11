import { supabase } from "/js/supabase.js";

import { requireAdmin } from "./admin-auth.js";

async function loadComponent(id, url) {
  const container = document.getElementById(id);
  if (!container) return;
  const html = await fetch(url).then(r => r.text());
  container.innerHTML = html;
}

/* ---------------------------------------------
   Mover esto dentro de initAdminShell()
----------------------------------------------*/
function setActiveSidebarLink() {
  const links = document.querySelectorAll(".sidebar-link");
  const current = window.location.pathname;

  links.forEach(link => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
}

/* ---------------------------------------------
   FUNCIÓN PRINCIPAL DEL ADMIN SHELL
----------------------------------------------*/
async function initAdminShell() {
  await requireAdmin();

  // 1. Cargar sidebar
  await loadComponent("adminSidebar", "/admin/components/admin-sidebar.html");

  // 2. Cargar header
  await loadComponent("adminHeader", "/admin/components/admin-header.html");

  console.log("[admin] Shell loaded.");

  // 3. IMPORTANTE → Ahora que el header EXISTE, actualizamos el nombre
  await loadAdminHeaderName();
}


/* ---------------------------------------------
   TOGGLE SIDEBAR
----------------------------------------------*/
document.addEventListener("click", (e) => {
  const btn = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".admin-sidebar");
  const header = document.querySelector(".admin-header-bar");

  if (e.target === btn) {
    sidebar.classList.toggle("sidebar-closed");
    header.classList.toggle("header-shifted");
  }
});

// =======================================================
// Cargar nombre del admin en header
// =======================================================

async function loadAdminHeaderName() {
  const nameEl = document.getElementById("adminUserName");
  const roleEl = document.getElementById("adminUserRole");
  const avatarEl = document.getElementById("adminAvatar");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, avatar_url")
    .eq("id", auth.user.id)
    .single();

  const name = profile?.full_name || auth.user.email.split("@")[0];
  const role = profile?.role || "usuario";

  nameEl.textContent = name;
  roleEl.textContent = role === "admin" ? "Administrador" : role;

  // Avatar
  if (profile?.avatar_url) {
    avatarEl.style.backgroundImage = `url(${profile.avatar_url})`;
    avatarEl.style.backgroundSize = "cover";
    avatarEl.textContent = "";
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }
}


/* ---------------------------------------------
   EJECUTAR INICIO DEL PANEL ADMIN
----------------------------------------------*/
initAdminShell();


// Avatar toggle menu
const avatar = document.getElementById("adminAvatar");
const menu = document.getElementById("adminMenu");

avatar.addEventListener("click", () => {
  menu.classList.toggle("hidden");
});

// Click fuera → cerrar
document.addEventListener("click", (e) => {
  if (!avatar.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

// Logout desde menú
document.getElementById("adminLogoutBtnMenu").onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "/auth/login.html";
};

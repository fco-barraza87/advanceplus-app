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

  // Carga componentes dinámicos
  await loadComponent("adminSidebar", "/admin/components/admin-sidebar.html");
  await loadComponent("adminHeader", "/admin/components/admin-header.html");

  // 🔥 AHORA QUE EL SIDEBAR EXISTE, ACTIVAMOS LA RUTA
  setActiveSidebarLink();

  console.log("[admin] Shell loaded.");
}

initAdminShell();

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
  const label = document.getElementById("adminUserLabel");
  if (!label) return;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    label.textContent = "No autenticado";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", auth.user.id)
    .single();

  if (profile?.full_name) {
    label.textContent = profile.full_name;
  } else {
    label.textContent = auth.user.email ?? "Admin";
  }
}

loadAdminHeaderName();

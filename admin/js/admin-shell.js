import { requireAdmin } from "./admin-auth.js";

async function loadComponent(id, url) {
  const container = document.getElementById(id);
  if (!container) return;
  const html = await fetch(url).then(r => r.text());
  container.innerHTML = html;
}

async function initAdminShell() {
  await requireAdmin();

  // RUTAS CORRECTAS
  await loadComponent("adminSidebar", "/admin/components/admin-sidebar.html");
  await loadComponent("adminHeader", "/admin/components/admin-header.html");

  console.log("[admin] Shell loaded.");
}

initAdminShell();

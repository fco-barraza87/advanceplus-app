import { requireAdmin } from "./admin-auth.js";

async function loadComponent(id, url) {
  const container = document.getElementById(id);
  if (!container) return;
  const html = await fetch(url).then(r => r.text());
  container.innerHTML = html;
}

async function initAdminShell() {
  await requireAdmin();

  await loadComponent("adminSidebar", "/components/admin-sidebar.html");
  await loadComponent("adminHeader", "/components/admin-header.html");

  console.log("[admin] Shell loaded.");
}

initAdminShell();

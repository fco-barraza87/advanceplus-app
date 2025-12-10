import { requireAdmin } from "./admin-auth.js";

async function loadComponent(id, url) {
  const container = document.getElementById(id);
  if (!container) return;
  const html = await fetch(url).then(r => r.text());
  container.innerHTML = html;
}

function setActiveSidebarLink() {
  const links = document.querySelectorAll(".sidebar-link");
  const current = window.location.pathname;

  links.forEach(link => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
}

setActiveSidebarLink();

async function initAdminShell() {
  await requireAdmin();

  await loadComponent("adminSidebar", "/admin/components/admin-sidebar.html");
  await loadComponent("adminHeader", "/admin/components/admin-header.html");

  console.log("[admin] Shell loaded.");
}

initAdminShell();

// Toggle del sidebar (mobile + desktop)
document.addEventListener("click", (e) => {
  const btn = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".admin-sidebar");
  const header = document.querySelector(".admin-header-bar");

  if (e.target === btn) {
    sidebar.classList.toggle("sidebar-closed");
    header.classList.toggle("header-shifted");
  }
});

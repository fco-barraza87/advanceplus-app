/* ============================================================
   PERFIL ADVANCE+ — Navegación Modular
   Carga dinámica de módulos HTML dentro de #content
   Lee usuario desde Supabase
   v1.0
============================================================ */

import { supabase } from "/js/supabase.js";

/* ============================================================
   🔹 Cargar datos del usuario (avatar, nombre, email)
============================================================ */
async function loadUserProfile() {
  const { data: session } = await supabase.auth.getUser();

  if (!session?.user) {
    window.location.href = "/";
    return;
  }

  const user = session.user;
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email.split("@")[0];

  const email = user.email;

  // Render en la UI
  document.getElementById("profile-name").textContent = name;
  document.getElementById("profile-email").textContent = email;

  // Avatar
  const initials = getInitials(name, email);
  document.getElementById("profile-avatar").textContent = initials;
}

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return (email?.[0] || "A").toUpperCase() + "+";
}

/* ============================================================
   🔹 Cargar módulos HTML dinámicamente
============================================================ */
async function loadModule(page) {
  const container = document.getElementById("content");

  try {
    const response = await fetch(`/perfil/${page}.html`);
    const html = await response.text();

    container.innerHTML = html;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    container.innerHTML = `
      <div style="padding: 20px; color: #ff6b6b;">
        Error cargando el módulo <strong>${page}</strong>.
      </div>
    `;
    console.error("Error cargando módulo:", err);
  }
}

/* ============================================================
   🔹 Activar clase "active" en el menú
============================================================ */
function setActiveMenu(item) {
  document.querySelectorAll(".menu-item").forEach((el) => {
    el.classList.remove("active");
  });
  item.classList.add("active");
}

/* ============================================================
   🔹 Listeners del menú
============================================================ */
function initMenu() {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.getAttribute("data-page");
      setActiveMenu(item);
      loadModule(page);
    });
  });
}

/* ============================================================
   🚀 Inicializar Perfil
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserProfile();
  initMenu();

  // Cargar módulo por defecto
  loadModule("datos");
});

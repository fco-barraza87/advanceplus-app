/* ============================================================
   PERFIL ADVANCE+
============================================================ */

import { supabase } from "/js/supabase.js";

/* Obtener perfil */
async function getProfile() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return null;

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

/* HEADER */
async function renderHeaderProfile() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  document.getElementById("profile-name").textContent =
    profile?.full_name || user.email.split("@")[0];

  document.getElementById("profile-email").textContent =
    profile?.email || user.email;

  const initials = (profile?.full_name || user.email)
    .split(" ")
    .map((x) => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatar = document.getElementById("profile-avatar");
  if (avatar) avatar.textContent = initials;
}

/* ============================================================
   🔥 Cargar módulos dinámicos SIN destruir avatar.js
============================================================ */
async function loadModule(page) {
  const container = document.getElementById("content");
  if (!container) return;

  // 🚫 NO recargar avatar.html si se está subiendo
  if (page === "avatar" && window.isUploadingAvatar) {
    console.warn("Evito recargar avatar porque está subiendo…");
    return;
  }

  try {
    const response = await fetch(`/perfil/${page}.html`);
    const html = await response.text();

    container.innerHTML = "";
    container.insertAdjacentHTML("beforeend", html);

    if (page === "datos") await fillDatosForm();
    if (page === "preferencias") await initPreferencias();
    if (page === "cursos") await initCursos();

    if (page === "avatar") {
      const module = await import("/perfil/js/avatar.js");
      requestAnimationFrame(() => {
        module.initAvatar();
      });
    }
  } catch (err) {
    container.innerHTML = `
      <div style="padding:20px; color:#ff6b6b;">
        Error cargando módulo <strong>${page}</strong>.
      </div>
    `;
  }
}

/* MENU */
function initMenu() {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      menuItems.forEach((m) => m.classList.remove("active"));
      item.classList.add("active");
      loadModule(item.dataset.page);
    });
  });
}

/* INICIO */
document.addEventListener("DOMContentLoaded", async () => {
  await renderHeaderProfile();
  initMenu();
  loadModule("datos");
});

/* (resto: datos, preferencias, cursos sin cambios) */

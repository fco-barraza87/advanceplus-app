/* ============================================================
   PERFIL ADVANCE+ — Modular
============================================================ */

import { supabase } from "/js/supabase.js";

/* ============================================================
   🔹 Función para obtener datos desde la tabla profiles
============================================================ */
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

/* ============================================================
   🔹 Rellenar HEADER del perfil
============================================================ */
async function renderHeaderProfile() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  document.getElementById("profile-name").textContent =
    profile?.full_name || user.email.split("@")[0];

  document.getElementById("profile-email").textContent =
    profile?.email || user.email;

  // Avatar iniciales
  const initials = (profile?.full_name || user.email)
    .split(" ")
    .map((x) => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.getElementById("profile-avatar").textContent = initials;
}

/* ============================================================
   🔹 Rellenar FORMULARIO de datos personales
============================================================ */
async function fillDatosForm() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  const fullName = document.getElementById("inputFullName");
  const email = document.getElementById("inputEmail");
  const country = document.getElementById("inputCountry");
  const language = document.getElementById("inputLanguage");

  if (fullName) fullName.value = profile?.full_name || "";
  if (email) {
    email.value = profile?.email || user.email;
    email.disabled = true; // no editable
  }
  if (country) country.value = profile?.country || "";
  if (language) language.value = profile?.language || "es";
}

/* ============================================================
   🔹 Cargar módulos HTML dinámicamente
============================================================ */
async function loadModule(page) {
  const container = document.getElementById("content");

  try {
    const response = await fetch(`/perfil/${page}.html`);
    container.innerHTML = await response.text();

    // Si cargamos datos.html → rellenar formulario
    if (page === "datos") {
      await fillDatosForm();
    }

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 20px; color: #ff6b6b;">
        Error cargando el módulo <strong>${page}</strong>.
      </div>
    `;
  }
}

/* ============================================================
   🔹 Activar clase active
============================================================ */
function initMenu() {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      menuItems.forEach((el) => el.classList.remove("active"));
      item.classList.add("active");

      const page = item.dataset.page;
      loadModule(page);
    });
  });
}

/* ============================================================
   🚀 Inicializar
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await renderHeaderProfile();
  initMenu();
  loadModule("datos");
});

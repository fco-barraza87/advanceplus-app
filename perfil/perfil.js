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
  if (!session?.user) return;

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Rellenar header
  document.getElementById("profile-name").textContent =
    profile?.full_name || user.email.split("@")[0];

  document.getElementById("profile-email").textContent = profile?.email || user.email;

  // Rellenar formulario (si existe la vista datos.html)
  const nameInput = document.getElementById("inputFullName");
  const countryInput = document.getElementById("inputCountry");
  const languageInput = document.getElementById("inputLanguage");

  if (nameInput) nameInput.value = profile.full_name || "";
  if (countryInput) countryInput.value = profile.country || "";
  if (languageInput) languageInput.value = profile.language || "";
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

    // ⬇️ Nuevo: volver a cargar el perfil SOLO si estamos en datos personales
    if (page === "datos") {
      await fillPersonalForm();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 20px; color: #ff6b6b;">
        Error cargando el módulo <strong>${page}</strong>.
      </div>
    `;
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

async function fillPersonalForm() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Inputs del formulario (si existen)
  const nameInput = document.getElementById("inputFullName");
  const emailInput = document.getElementById("inputEmail");
  const countryInput = document.getElementById("inputCountry");
  const languageInput = document.getElementById("inputLanguage");
  const birthdayInput = document.getElementById("inputBirthday");

  if (nameInput) nameInput.value = profile?.full_name || "";
  if (emailInput) emailInput.value = profile?.email || user.email;
  if (countryInput) countryInput.value = profile?.country || "";
  if (languageInput) languageInput.value = profile?.language || "es";
  if (birthdayInput) birthdayInput.value = profile?.birthday || "";
}


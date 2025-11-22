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

  document.getElementById("inputFullName").value = profile?.full_name || "";
  document.getElementById("inputEmail").value = profile?.email || user.email;
  document.getElementById("inputCountry").value = profile?.country || "";
  document.getElementById("inputLanguage").value = profile?.language || "es";

  if (profile?.birthdate)
    document.getElementById("inputBirthdate").value = profile.birthdate;
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

/* ============================================================
   🔹 Guardar cambios del formulario Datos Personales
============================================================ */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-datos") return;
  e.preventDefault();

  const msg = document.getElementById("datosMsg");
  msg.textContent = "Guardando...";

  // ✅ FIX: obtener usuario correctamente
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    msg.textContent = "❌ No hay usuario autenticado.";
    msg.style.color = "#ff6b6b";
    return;
  }

  const updates = {
    full_name: document.getElementById("inputFullName").value,
    country: document.getElementById("inputCountry").value,
    language: document.getElementById("inputLanguage").value,
    birthdate: document.getElementById("inputBirthdate").value,
    updated_at: new Date()
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  msg.style.color = updateError ? "#ff6b6b" : "#3ee98a";
  msg.textContent = updateError
    ? "❌ Error guardando"
    : "✔ Guardado con éxito";
});

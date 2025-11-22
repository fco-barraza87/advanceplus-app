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
  document.getElementById("inputPais").value = profile?.pais || "";
  document.getElementById("inputIdioma").value = profile?.idioma || "es";

  if (profile?.nacimiento)
    document.getElementById("inputNacimiento").value = profile.nacimiento;
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

    // Si cargamos preferencias.html → inicializar módulo preferencias
    if (page === "preferencias") {
      await initPreferencias();
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
   🔹 Guardar cambios del formulario Datos Personales (dinámico)
============================================================ */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-datos") return;
  e.preventDefault();

  const msg = document.getElementById("datosMsg");
  msg.textContent = "Guardando...";

  // Obtener usuario autenticado
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    msg.textContent = "❌ No hay usuario autenticado.";
    msg.style.color = "#ff6b6b";
    return;
  }

  // Leer valores del formulario
  const fullName = document.getElementById("inputFullName").value.trim();
  const pais = document.getElementById("inputPais").value.trim();
  const idioma = document.getElementById("inputIdioma").value.trim();
  const birthdate = document.getElementById("inputNacimiento").value.trim();

  // Construcción dinámica del objeto updates
  const updates = {};

  if (fullName) updates.full_name = fullName;
  if (pais) updates.pais = pais;
  if (idioma) updates.idioma = idioma;
  if (birthdate) updates.birthdate = birthdate;

  // Si no hay nada que actualizar → igual mostramos éxito
  if (Object.keys(updates).length === 0) {
    msg.style.color = "#3ee98a";
    msg.textContent = "✔ Nada que actualizar";
    return;
  }

  updates.updated_at = new Date();

  // Actualizar en tabla profiles
  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  msg.style.color = updateError ? "#ff6b6b" : "#3ee98a";
  msg.textContent = updateError
    ? "❌ Error guardando"
    : "✔ Cambios guardados con éxito";
});


/* ============================================================
   🔹 Inicializar módulo de PREFERENCIAS
   Lee de profiles.notifications (y fallback a user_metadata.prefs)
============================================================ */
async function initPreferencias() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  // 1) Preferencias desde profiles.notifications
  // 2) Si está vacío, usamos fallback desde auth.user_metadata.prefs
  const prefs =
    profile?.notifications && Object.keys(profile.notifications).length > 0
      ? profile.notifications
      : user.user_metadata?.prefs || {};

  // Setear valores con defaults elegantes
  const elModoExpress = document.getElementById("modoExpress");
  const elNotifDiarias = document.getElementById("notifDiarias");
  const elNotifRacha = document.getElementById("notifRacha");
  const elTemaVisual = document.getElementById("temaVisual");
  const elPrivNombre = document.getElementById("privNombre");
  const msg = document.getElementById("prefMsg");

  if (!elModoExpress || !elNotifDiarias || !elNotifRacha || !elTemaVisual || !elPrivNombre) {
    console.warn("⚠ Elementos de preferencias no encontrados en el DOM.");
    return;
  }

  elModoExpress.checked = prefs.modoExpress ?? true;
  elNotifDiarias.checked = prefs.notifDiarias ?? true;
  elNotifRacha.checked = prefs.notifRacha ?? true;
  elTemaVisual.value = prefs.temaVisual || "auto";
  elPrivNombre.checked = prefs.privNombre ?? true;

  // Handler de guardado
  const form = document.getElementById("form-preferencias");
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    if (msg) {
      msg.textContent = "Guardando...";
      msg.style.color = "#fff";
    }

    const newPrefs = {
      modoExpress: elModoExpress.checked,
      notifDiarias: elNotifDiarias.checked,
      notifRacha: elNotifRacha.checked,
      temaVisual: elTemaVisual.value,
      privNombre: elPrivNombre.checked
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        notifications: newPrefs,
        updated_at: new Date()
      })
      .eq("id", user.id);

    if (msg) {
      msg.style.color = updateError ? "#ff6b6b" : "#3ee98a";
      msg.textContent = updateError
        ? "❌ Error guardando preferencias"
        : "✔ Preferencias guardadas";
    }
  };
}

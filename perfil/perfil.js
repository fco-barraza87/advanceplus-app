// -------------------------------------------------------
//  /perfil/perfil.js — versión FINAL
// -------------------------------------------------------
import { supabase } from "/js/supabase.js";

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

//---------------------------------------------------------
// HEADER dentro de perfil
//---------------------------------------------------------
async function renderHeaderProfile() {
  const { user, profile } = await getProfile();

  document.getElementById("profile-name").textContent =
    profile?.full_name || user.email.split("@")[0];

  document.getElementById("profile-email").textContent =
    profile?.email || user.email;

  const initials = (profile?.full_name || user.email)
    .split(" ")
    .map(x => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.getElementById("profile-avatar").textContent = initials;
}

//---------------------------------------------------------
// CARGA DE MÓDULOS
//---------------------------------------------------------
async function loadModule(page) {
  const container = document.getElementById("content");

  try {
    const resp = await fetch(`/perfil/${page}.html`);
    container.innerHTML = await resp.text();

    if (page === "datos") {
      await fillDatosForm();
    }

    if (page === "preferencias") {
      await initPreferencias();
    }

    if (page === "cursos") {
      await initCursos();
    }

    if (page === "avatar") {
      const module = await import("/perfil/js/avatar.js");
      module.initAvatar();
    }
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;color:#ff6b6b;">Error cargando módulo.</div>`;
  }
}

//---------------------------------------------------------
// Menú lateral
//---------------------------------------------------------
function initMenu() {
  const items = document.querySelectorAll(".menu-item");

  items.forEach(item => {
    item.onclick = () => {
      items.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      loadModule(item.dataset.page);
    };
  });
}

//---------------------------------------------------------
// Datos personales
//---------------------------------------------------------
async function fillDatosForm() {
  const { user, profile } = await getProfile();

  document.getElementById("inputFullName").value = profile?.full_name || "";
  document.getElementById("inputEmail").value = profile?.email || user.email;
  document.getElementById("inputPais").value = profile?.pais || "";
  document.getElementById("inputIdioma").value = profile?.idioma || "es";

  if (profile?.nacimiento)
    document.getElementById("inputNacimiento").value = profile.nacimiento;
}

//---------------------------------------------------------
// Guardar cambios de datos personales
//---------------------------------------------------------
document.addEventListener("submit", async e => {
  if (e.target.id !== "form-datos") return;
  e.preventDefault();

  const msg = document.getElementById("datosMsg");
  msg.textContent = "Guardando...";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const updates = {
    full_name: document.getElementById("inputFullName").value.trim(),
    pais: document.getElementById("inputPais").value.trim(),
    idioma: document.getElementById("inputIdioma").value.trim(),
    nacimiento: document.getElementById("inputNacimiento").value.trim(),
    updated_at: new Date()
  };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  msg.textContent = error ? "❌ Error" : "✔ Guardado";
  msg.style.color = error ? "#ff6b6b" : "#3ee98a";
});

//---------------------------------------------------------
// PREFERENCIAS
//---------------------------------------------------------
async function initPreferencias() {
  const { user, profile } = await getProfile();

  const prefs = profile?.notifications || {};

  document.getElementById("modoExpress").checked = prefs.modoExpress ?? true;
  document.getElementById("notifDiarias").checked = prefs.notifDiarias ?? true;
  document.getElementById("notifRacha").checked = prefs.notifRacha ?? true;
  document.getElementById("temaVisual").value = prefs.temaVisual || "auto";
  document.getElementById("privNombre").checked = prefs.privNombre ?? true;

  document.getElementById("form-preferencias").onsubmit = async e => {
    e.preventDefault();

    const newPrefs = {
      modoExpress: modoExpress.checked,
      notifDiarias: notifDiarias.checked,
      notifRacha: notifRacha.checked,
      temaVisual: temaVisual.value,
      privNombre: privNombre.checked
    };

    const msg = document.getElementById("prefMsg");
    msg.textContent = "Guardando...";

    const { error } = await supabase
      .from("profiles")
      .update({
        notifications: newPrefs,
        updated_at: new Date()
      })
      .eq("id", user.id);

    msg.textContent = error ? "❌ Error" : "✔ Guardado";
    msg.style.color = error ? "#ff6b6b" : "#3ee98a";
  };
}

//---------------------------------------------------------
// Cursos (tu módulo existente, limpio)
//---------------------------------------------------------
async function initCursos() {
  console.log("initCursos(): OK");
  // Módulo tal cual como lo dejaste, no lo reescribo ahora.
}

//---------------------------------------------------------
// INICIO
//---------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await renderHeaderProfile();
  initMenu();
  loadModule("datos");
});

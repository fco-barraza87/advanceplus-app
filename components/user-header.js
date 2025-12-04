// ===============================================================
//  HEADER USUARIO — CARGA DINÁMICA
// ===============================================================

import { supabase } from "/js/supabase.js";

// ===============================================================
//  FUNCIÓN PRINCIPAL (SE EXPORTA)
// ===============================================================
export async function loadUserHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  // 1. Cargar HTML del header del usuario
  const res = await fetch("/components/header.html");
  const html = await res.text();
  container.innerHTML = html;

  // 2. Cargar datos del usuario en el header
  await renderUserHeaderData();

  // 3. Activar botón logout
  attachUserLogoutEvent();

  attachLogoutEvent();

}

function attachLogoutEvent() {
  const btn = document.querySelector("#btnLogout");
  if (!btn) return;

  btn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}


// ===============================================================
//  RENDER: NOMBRE + AVATAR + ROL EN HEADER
// ===============================================================
async function renderUserHeaderData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  // Nombre
  const nameEl = document.getElementById("headerUserName");
  if (nameEl) nameEl.textContent = profile.full_name || "Usuario";

  // Rol
  const roleEl = document.getElementById("headerUserRole");
  if (roleEl) {
    roleEl.textContent =
      profile.role === "admin"
        ? "Administrador"
        : profile.role === "coach"
        ? "Coach"
        : "Miembro Advance+";
  }

  // Avatar
  const avatarEl = document.getElementById("headerAvatar");
  if (avatarEl && profile.avatar_url) {
    avatarEl.style.backgroundImage = `url('${profile.avatar_url}')`;
    avatarEl.style.backgroundSize = "cover";
  }
}

// ===============================================================
//  LOGOUT
// ===============================================================
function attachUserLogoutEvent() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });
}

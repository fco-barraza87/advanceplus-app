// ===============================================================
//  HEADER USUARIO — CARGA DINÁMICA (VERSIÓN ESTABLE DEFINITIVA)
// ===============================================================

// 🔥 IMPORTA EL CLIENTE *DIRECTO* SIEMPRE
import { supabase } from "/js/supabase.js";

// ===============================================================
//  CARGAR HEADER + ESPERAR A QUE EXISTA EN EL DOM
// ===============================================================
export async function loadUserHeader() {
  try {
    const container = document.getElementById("appHeader");
    if (!container) return;

    // 1. Descargar HTML
    const res = await fetch("/components/header.html");
    const html = await res.text();
    container.innerHTML = html;

    // 2. SOLO después del HTML → render
    await renderUserHeaderData();

    // 3. Activar menú avatar
    setupAvatarMenu();

    // 4. Logout
    setupLogoutButtons();

  } catch (err) {
    console.error("❌ Error cargando header:", err);
  }
}

// ===============================================================
//  RENDER DE LA INFO DEL USUARIO
// ===============================================================
async function renderUserHeaderData() {
  try {
    // ⚡ Asegura sesión válida
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Obtener datos del perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", user.id)
      .single();

    if (!profile) return;

    // Aplicar al DOM
    const nameEl  = document.getElementById("headerUserName");
    const roleEl  = document.getElementById("headerUserRole");
    const avatarEl = document.getElementById("headerAvatar");

    if (nameEl) nameEl.textContent = profile.full_name || "Usuario";

    if (roleEl) {
      roleEl.textContent =
        profile.role === "admin"
          ? "Administrador"
          : profile.role === "coach"
          ? "Coach"
          : "Miembro Advance+";
    }

    if (avatarEl && profile.avatar_url) {
      avatarEl.style.backgroundImage = `url('${profile.avatar_url}')`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.color = "transparent";
    }

  } catch (err) {
    console.error("❌ Error renderizando datos del header:", err);
  }
}

// ===============================================================
//  MENÚ AVATAR
// ===============================================================
function setupAvatarMenu() {
  const avatar = document.getElementById("headerAvatar");
  const menu = document.getElementById("userMenu");

  if (!avatar || !menu) return;

  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== avatar) {
      menu.classList.add("hidden");
    }
  });
}

// ===============================================================
//  LOGOUT
// ===============================================================
function setupLogoutButtons() {
  const btnMini = document.getElementById("logoutMiniBtn");

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };

  if (btnMini) btnMini.onclick = logout;
}

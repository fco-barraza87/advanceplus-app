// ===============================================================
//  HEADER USUARIO — CARGA DINÁMICA
// ===============================================================
export async function loadUserHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  // 1. Cargar HTML del header
  const res = await fetch("/components/header.html");
  container.innerHTML = await res.text();

  // *** FIX CRÍTICO ***
  // Esperar a que el DOM agregue realmente los elementos insertados
  await new Promise(requestAnimationFrame);

  // 2. Render de datos
  await renderUserHeaderData();

  // 3. Activar menú
  setupAvatarMenu();

  // 4. Activar logout
  setupLogoutButtons();
}


// ===============================================================
//  RENDER INFO
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

  const nameEl = document.getElementById("headerUserName");
  const roleEl = document.getElementById("headerUserRole");
  const avatarEl = document.getElementById("headerAvatar");

  if (nameEl) nameEl.textContent = profile.full_name;
  if (roleEl) {
    roleEl.textContent =
      profile.role === "admin"
        ? "Administrador"
        : profile.role === "coach"
        ? "Coach"
        : "Miembro Advance+";
  }

  if (avatarEl) {
    if (profile.avatar_url) {
      avatarEl.style.backgroundImage = `url('${profile.avatar_url}')`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.color = "transparent";
    }
  }
}

// ===============================================================
//  MENU AVATAR — FIX DEFINITIVO
// ===============================================================
function setupAvatarMenu() {
  const avatar = document.getElementById("headerAvatar");
  const menu = document.getElementById("userMenu");

  if (!avatar || !menu) return;

  // Al hacer clic en avatar → abrir/cerrar menú
  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  // Cerrar al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });
}

// ===============================================================
//  LOGOUT (botón principal y botón del menú)
// ===============================================================
function setupLogoutButtons() {
  const btn1 = document.getElementById("btnLogout");
  const btn2 = document.getElementById("logoutMiniBtn");

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };

  if (btn1) btn1.onclick = logout;
  if (btn2) btn2.onclick = logout;
}

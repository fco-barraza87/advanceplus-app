// /components/header.js
import { supabase } from "/js/supabase.js";

export async function loadHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  container.innerHTML = `
    <header class="header-premium">
      <div class="header-left">
        <button id="btnBack" class="header-btn-back">⟵</button>

        <div class="header-logo">Advance+</div>

        <div class="header-user clickable" id="headerProfileBtn">
          <div id="userAvatar" class="header-avatar">A+</div>
          <div class="header-user-info">
            <div id="userName" class="header-user-name">Usuario</div>
            <div id="userRole" class="header-user-role">Miembro Advance+</div>
          </div>
        </div>
      </div>

      <div class="header-right">
        <button id="btnLogout" class="header-btn-logout">Cerrar sesión</button>
      </div>
    </header>
  `;

  /* ======================================
     🔹 Obtener sesión
  ====================================== */
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  /* ======================================
     🔹 Perfiles
  ====================================== */
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  /* Nombre */
  document.getElementById("userName").textContent =
    profile?.full_name || user.email.split("@")[0];

  /* Rol */
  document.getElementById("userRole").textContent =
    profile?.role === "admin" ? "Administrador"
    : profile?.role === "coach" ? "Coach"
    : "Miembro Advance+";

  /* Avatar */
  const avatar = document.getElementById("userAvatar");
  if (profile?.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.backgroundSize = "cover";
    avatar.textContent = "";
  }

  /* ======================================
     🔹 Acceso a Perfil
  ====================================== */
  document.getElementById("headerProfileBtn").onclick = () => {
    window.location.href = "/perfil/index.html";
  };

  /* ======================================
     🔹 Botón volver
  ====================================== */
  document.getElementById("btnBack").onclick = () => {
    history.back();
  };

  /* ======================================
     🔹 Logout
  ====================================== */
  document.getElementById("btnLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

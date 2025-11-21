// /components/header.js
import { supabase } from "/js/supabase.js";

export async function loadHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  container.innerHTML = `
    <header class="header-premium">
      <div class="header-left">

        <!-- Botón Volver -->
        <button id="btnBack" class="header-btn-back">⟵</button>

        <div class="header-logo">Advance+</div>

        <div class="header-user">
          <div id="userAvatar" class="header-avatar">A+</div>
          <div class="header-user-info">
            <div id="userName" class="header-user-name">Usuario</div>
            <div id="userRole" class="header-user-role">Miembro Advance+</div>
          </div>
        </div>
      </div>

      <div class="header-right">
        <button id="btnLogout" class="header-btn-logout">Cerrar sesión</button>
        <button id="btnMenuMobile" class="header-btn-mobile">☰</button>
      </div>
    </header>
  `;

  // ------------ LOGIN / PERFIL ------------
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", user.id)
      .single();

    if (profile) {
      document.getElementById("userName").textContent =
        profile.full_name || "Usuario";

      document.getElementById("userRole").textContent =
        profile.role === "admin"
          ? "Administrador Advance+"
          : profile.role === "coach"
          ? "Coach Advance+"
          : "Miembro Advance+";

      const avatar = document.getElementById("userAvatar");
      if (profile.avatar_url) {
        avatar.style.backgroundImage = `url(${profile.avatar_url})`;
        avatar.style.color = "transparent";
        avatar.style.backgroundSize = "cover";
      }
    }
  }

  // ------------ VOLVER ------------
  const btnBack = document.getElementById("btnBack");
  btnBack.addEventListener("click", () => {
    if (document.referrer && document.referrer.includes(location.host)) {
      history.back();
    } else {
      window.location.href = "/dashboard/index.html";
    }
  });

  // ------------ LOGOUT ------------
  document.getElementById("btnLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

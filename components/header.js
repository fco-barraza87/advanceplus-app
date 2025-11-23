//-------------------------------------------------------
//  /components/header.js  —  versión corregida
//-------------------------------------------------------
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
          <div id="headerAvatar" class="header-avatar">
            <img id="headerAvatarImg" class="header-avatar-img" />
            <div id="headerAvatarInitials" class="header-avatar-initials">A+</div>
          </div>

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

  // Obtener usuario
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Obtener perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  const name = profile?.full_name || user.email.split("@")[0];

  document.getElementById("userName").textContent = name;
  document.getElementById("userRole").textContent =
    profile?.role === "admin"
      ? "Administrador"
      : profile?.role === "coach"
      ? "Coach"
      : "Miembro Advance+";

  updateHeaderAvatar(profile?.avatar_url, name);

  //------------------------------------
  // Navegación
  //------------------------------------
  document.getElementById("headerProfileBtn").onclick = () => {
    window.location.href = "/perfil/index.html";
  };

  document.getElementById("btnBack").onclick = () => history.back();

  document.getElementById("btnLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

//-------------------------------------------------------
//  Avatar dinámico para Header — usado por avatar.js
//-------------------------------------------------------
window.updateHeaderAvatar = function (url, fullName) {
  const img = document.getElementById("headerAvatarImg");
  const initialsDiv = document.getElementById("headerAvatarInitials");

  if (!img || !initialsDiv) return;

  if (url) {
    img.src = url;
    img.style.display = "block";
    initialsDiv.style.display = "none";
  } else {
    const initials = (fullName || "?")
      .split(" ")
      .map((x) => x[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    initialsDiv.textContent = initials;
    initialsDiv.style.display = "flex";
    img.style.display = "none";
  }
};

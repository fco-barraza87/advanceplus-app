// /components/header.js
import { supabase } from "/js/supabase.js";

export async function loadHeader() {
  const headerContainer = document.getElementById("appHeader");
  if (!headerContainer) return;

container.innerHTML = `
  <header class="header-premium">
    <div class="header-left">
      <button id="btnBack" class="header-btn-back">⟵</button>

      <div class="header-logo">Advance+</div>
    </div>

    <div class="header-right">
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

      <button id="btnLogout" class="header-btn-logout">Salir</button>
    </div>
  </header>
`;


  // Obtener perfil
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const name = profile?.full_name || user.email;
  const initials = name.split(" ").map(x => x[0]).join("").toUpperCase();

  const avatarImg = document.getElementById("headerAvatarImg");
  const avatarInit = document.getElementById("headerAvatarInitials");

  // SI HAY avatar_url → MOSTRAR IMAGEN
  if (profile?.avatar_url) {
    avatarImg.src = profile.avatar_url;
    avatarImg.style.display = "block";
    avatarInit.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarInit.style.display = "flex";
    avatarInit.textContent = initials;
  }

  document.getElementById("headerName").textContent = name;

  // Logout
  document.getElementById("btnLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };

  // EXPOSE for avatar.js
  window.updateHeaderAvatar = function(url, nameOverride) {
    const newName = nameOverride || name;
    const newInit = newName.split(" ").map(x => x[0]).join("").toUpperCase();

    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = "block";
      avatarInit.style.display = "none";
    } else {
      avatarImg.style.display = "none";
      avatarInit.style.display = "flex";
      avatarInit.textContent = newInit;
    }

    document.getElementById("headerName").textContent = newName;
  };

  document.getElementById("headerProfileBtn").onclick = () => {
  window.location.href = "/perfil/index.html";
};

}



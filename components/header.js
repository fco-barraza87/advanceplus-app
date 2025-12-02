// /components/header.js
import { supabase } from "/js/supabase.js";

export async function loadHeader() {
  const headerContainer = document.getElementById("appHeader");
  if (!headerContainer) return;

  // 🔹 INSERTA EL HEADER CORRECTO
  headerContainer.innerHTML = `
    <header class="header-premium">
      <div class="header-left">
        <button id="btnBack" class="header-btn-back">⟵</button>
        <div class="header-logo">Advance+</div>
      </div>

                  <!-- Navegación superior -->
      <nav class="admin-nav">
        <a href="/admin/index.html" class="nav-link">Dashboard</a>
        <a href="/admin/users.html" class="nav-link nav-link--active">Usuarios</a>
        <a href="/admin/courses.html" class="nav-link">Cursos</a>
        <a href="/admin/lessons.html" class="nav-link">Lecciones</a>
        <a href="/admin/progress.html" class="nav-link">Progreso</a>
        <a href="/admin/marketing.html" class="nav-link">Marketing</a>
        <a href="/admin/settings.html" class="nav-link">Settings</a>
      </nav>

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

  // -----------------------------------------------------
  // 🔹 OBTENER USUARIO LOGEADO
  // -----------------------------------------------------
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const user = session.user;

  // -----------------------------------------------------
  // 🔹 OBTENER PERFIL
  // -----------------------------------------------------
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const name = profile?.full_name || user.email;
  const initials = name
    .split(" ")
    .map(x => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatarImg = document.getElementById("headerAvatarImg");
  const avatarInit = document.getElementById("headerAvatarInitials");
  const userNameEl = document.getElementById("userName");
  const roleEl = document.getElementById("userRole");

  // -----------------------------------------------------
  // 🔹 RENDER NOMBRE Y ROL
  // -----------------------------------------------------
  userNameEl.textContent = name;
  roleEl.textContent =
    profile?.role === "admin"
      ? "Administrador"
      : profile?.role === "coach"
      ? "Coach"
      : "Miembro Advance+";

  // -----------------------------------------------------
  // 🔹 AVATAR (imagen o iniciales)
  // -----------------------------------------------------
  if (profile?.avatar_url) {
    avatarImg.src = profile.avatar_url;
    avatarImg.style.display = "block";
    avatarInit.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarInit.style.display = "flex";
    avatarInit.textContent = initials;
  }

  // -----------------------------------------------------
  // 🔹 CLICK AL PERFIL
  // -----------------------------------------------------
  document.getElementById("headerProfileBtn").onclick = () => {
    window.location.href = "/perfil/index.html";
  };

  // -----------------------------------------------------
  // 🔹 LOGOUT
  // -----------------------------------------------------
  document.getElementById("btnLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };

  // -----------------------------------------------------
  // 🔹 MÉTODO GLOBAL PARA ACTUALIZAR AVATAR DESDE avatar.js
  // -----------------------------------------------------
  window.updateHeaderAvatar = function (url, newName) {
    const finalName = newName || name;
    const newInitials = finalName
      .split(" ")
      .map(x => x[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = "block";
      avatarInit.style.display = "none";
    } else {
      avatarImg.style.display = "none";
      avatarInit.style.display = "flex";
      avatarInit.textContent = newInitials;
    }

    userNameEl.textContent = finalName;
  };
}


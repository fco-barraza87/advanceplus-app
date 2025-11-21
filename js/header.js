import { supabase } from "/js/supabase.js";

async function loadGlobalHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  // Cargar HTML del header
  const html = await fetch("/components/header.html").then((r) => r.text());
  container.innerHTML = html;

  // Obtener usuario
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Cargar datos desde profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  // Renderizar
  document.getElementById("headerName").textContent =
    profile?.full_name || "Usuario";

  document.getElementById("headerRole").textContent =
    profile?.role === "admin"
      ? "Admin Advance+"
      : profile?.role === "coach"
      ? "Coach Advance+"
      : "Miembro Advance+";

  const avatar = document.getElementById("headerAvatar");
  if (profile?.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.textContent = "";
  } else {
    const initials = (profile?.full_name || "A+")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
    avatar.textContent = initials;
  }

  // Botón Cerrar Sesión
  document.getElementById("btnLogoutGlobal").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };

  // Botón Perfil
  document.getElementById("btnProfile").onclick = () => {
    window.location.href = "/perfil/index.html";
  };

  // Botón volver
  document.getElementById("btnGoBack").onclick = () => {
    window.history.back();
  };
}

document.addEventListener("DOMContentLoaded", loadGlobalHeader);

import { supabase } from "/js/supabase.js";

function initialsFromName(name) {
  if (!name) return "U";

  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export async function loadUserHeader() {
  // 1. Obtener sesión
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  // 2. Traer perfil desde DB
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  // 3. Rellenar header
  document.getElementById("headerUserName").textContent =
    profile?.full_name || user.email.split("@")[0];

  document.getElementById("headerUserRole").textContent =
    (profile?.role || "user").toUpperCase();

  const avatarBox = document.getElementById("headerAvatar");

  // 4. Mostrar avatar real o iniciales
  if (profile?.avatar_url) {
    avatarBox.innerHTML = `<img src="${profile.avatar_url}" alt="avatar">`;
  } else {
    avatarBox.textContent = initialsFromName(profile?.full_name || user.email);
  }

  // Logout
  document.getElementById("btnLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

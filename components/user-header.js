import { supabase } from "/js/supabase.js";

export async function loadUserHeader() {
  // 1) Obtener usuario actual
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  const userId = user.id;

  // 2) Cargar perfil desde "profiles"
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", userId)
    .single();

  // 3) Rellenar UI
  document.getElementById("headerUserName").textContent =
    profile?.full_name || "Usuario";

  document.getElementById("headerUserRole").textContent =
    profile?.role?.toUpperCase() || "USER";

  document.getElementById("headerAvatar").src =
    profile?.avatar_url || "/img/default-avatar.png";

  // 4) Botón logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });
}

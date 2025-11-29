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

    const avatarDiv = document.getElementById("headerAvatar");

    if (profile?.avatar_url) {
    avatarDiv.innerHTML = `<img src="${profile.avatar_url}" alt="avatar">`;
    } else {
    const { initials, bg } = generateInitialAvatar(profile?.full_name || "U S");
    avatarDiv.style.background = bg;
    avatarDiv.textContent = initials;
    }


  // 4) Botón logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });

    function generateInitialAvatar(name) {
    const initials = name
        .split(" ")
        .map(w => w.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase();

    const colors = ["#C0A450", "#4A90E2", "#50E3C2", "#B96BF5", "#F56262"];
    const bg = colors[Math.floor(Math.random() * colors.length)];

    return { initials, bg };
    }

}

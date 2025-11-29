import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";
import { loadUserHeader } from "/components/user-header.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const user = session.user;

  // Obtener perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Rellenar campos
  document.getElementById("input_fullname").value = profile?.fullname ?? "";
  document.getElementById("input_country").value = profile?.country ?? "";

  document.getElementById("p_email").textContent = user.email;
  document.getElementById("p_role").textContent = profile?.role ?? "user";
  document.getElementById("p_created").textContent =
    new Date(profile?.created_at).toLocaleDateString();

  // Guardar cambios
  document.getElementById("saveProfileBtn").addEventListener("click", async () => {
    const fullname = document.getElementById("input_fullname").value.trim();
    const country = document.getElementById("input_country").value.trim();

    const { error } = await supabase
      .from("profiles")
      .update({
        fullname,
        country,
      })
      .eq("id", user.id);

    const message = document.getElementById("saveMessage");

    if (error) {
      message.textContent = "❌ Error al guardar.";
      message.style.color = "#ff6b6b";
      return;
    }

    message.textContent = "✔️ Cambios guardados.";
    message.style.color = "#5af08a";

    // Refrescar header con nombre nuevo
    loadUserHeader();
  });
});

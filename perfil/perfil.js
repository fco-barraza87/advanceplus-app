import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";
import { loadUserHeader } from "/components/user-header.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;
  const user = session.user;

  // Obtener datos desde la tabla real "profiles"
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error cargando perfil:", error);
    return;
  }

  // Inputs del HTML (los que tú tienes real)
  const inputFullName = document.getElementById("input_fullname");
  const inputCountry = document.getElementById("input_country");
  const pEmail = document.getElementById("p_email");
  const pCreated = document.getElementById("p_created");
  
  // Rellenar valores
  inputFullName.value = profile?.full_name ?? "";
  inputCountry.value = profile?.country ?? "";
  pEmail.textContent = user.email;
  pCreated.textContent = new Date(profile?.created_at).toLocaleDateString();

  // Guardar cambios
  document.getElementById("saveProfileBtn").addEventListener("click", async () => {

    const updates = {
      full_name: inputFullName.value.trim(),
      country: inputCountry.value.trim(),
      updated_at: new Date(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    const msg = document.getElementById("saveMessage");

    if (updateError) {
      msg.textContent = "❌ Error al guardar";
      msg.style.color = "#ff6b6b";
      console.error(updateError);
      return;
    }

    msg.textContent = "✔ Cambios guardados";
    msg.style.color = "#3ee98a";

    // Actualizar header automáticamente
    loadUserHeader();
  });
});

import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";
import { loadUserHeader } from "/components/user-header.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const user = session.user;

  // Obtener perfil de la tabla REAL
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const inputFullName = document.getElementById("inputFullName");
  const inputPais = document.getElementById("inputPais");
  const inputIdioma = document.getElementById("inputIdioma");
  const inputNacimiento = document.getElementById("inputNacimiento");

  inputFullName.value = profile?.full_name ?? "";
  inputPais.value = profile?.country ?? "";
  inputIdioma.value = profile?.language ?? "es";
  inputNacimiento.value = profile?.birthdate ?? "";

  document.getElementById("inputEmail").value = user.email;

  // Guardar cambios
  document.getElementById("form-datos").onsubmit = async (e) => {
    e.preventDefault();

    const updates = {
      full_name: inputFullName.value,
      country: inputPais.value,
      language: inputIdioma.value,
      birthdate: inputNacimiento.value,
      updated_at: new Date(),
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    const msg = document.getElementById("datosMsg");

    if (error) {
      msg.textContent = "❌ Error al guardar";
      msg.style.color = "#ff6b6b";
      console.log(error);
      return;
    }

    msg.textContent = "✔ Datos guardados";
    msg.style.color = "#3ee98a";

    // Refrescar header
    loadUserHeader();
  };
});

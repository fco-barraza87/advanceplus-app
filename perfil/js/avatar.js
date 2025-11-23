// /perfil/js/avatar.js
import { supabase } from "/js/supabase.js";

// Utilidad local para obtener user + profile
async function getProfile() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return null;

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

export async function initAvatar() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  // Elementos del DOM
  const preview   = document.getElementById("avatarPreview");     // <img>
  const initials  = document.getElementById("avatarInitials");    // <div>
  const input     = document.getElementById("avatarInput");
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const deleteBtn = document.getElementById("avatarDeleteBtn");
  const msg       = document.getElementById("avatarMsg");

  if (!preview || !initials || !input || !uploadBtn || !deleteBtn || !msg) {
    console.warn("⚠ Elementos de avatar no encontrados en el DOM.");
    return;
  }

  // Nombre para iniciales
  const nameForInitials = profile?.full_name || user.email;
  const init = nameForInitials
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // ------------------------------------------
  // Mostrar estado inicial (imagen o iniciales)
  // ------------------------------------------
  if (profile?.avatar_url) {
    preview.src = profile.avatar_url;
    preview.classList.remove("hidden");
    initials.classList.add("hidden");
  } else {
    preview.classList.add("hidden");
    initials.textContent = init;
    initials.classList.remove("hidden");
  }

  // ------------------------------------------
  // Click en "Subir nueva foto" → abre input
  // ------------------------------------------
  uploadBtn.onclick = () => input.click();

  // ------------------------------------------
  // SUBIR AVATAR
  // ------------------------------------------
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    msg.textContent = "Subiendo...";
    msg.style.color = "#fff";

    // Validar tamaño (2 MB)
    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ Máximo permitido 2MB.";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Vista previa instantánea
    const tmpUrl = URL.createObjectURL(file);
    preview.src = tmpUrl;
    preview.classList.remove("hidden");
    initials.classList.add("hidden");

    const ext = file.name.split(".").pop();
    const filePath = `profiles/${user.id}/avatar.${ext}`;

    // Subir al bucket avatars (con upsert)
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      msg.textContent = "❌ Error al subir.";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Obtener URL pública
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Guardar en BD
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error(updateError);
      msg.textContent = "❌ Error guardando en perfil.";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Actualizar UI final
    preview.src = publicUrl;
    preview.classList.remove("hidden");
    initials.classList.add("hidden");

    // Actualizar header global si existe
    if (window.updateHeaderAvatar) {
      window.updateHeaderAvatar(publicUrl, nameForInitials);
    }

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  };

  // ------------------------------------------
  // ELIMINAR AVATAR
  // ------------------------------------------
  deleteBtn.onclick = async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;

    // Listar archivos dentro de profiles/{user.id}
    const { data: files, error: listError } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (listError) {
      console.error(listError);
    } else if (files && files.length) {
      const paths = files.map((f) => `${folder}/${f.name}`);
      const { error: removeError } = await supabase.storage
        .from("avatars")
        .remove(paths);

      if (removeError) {
        console.error(removeError);
      }
    }

    // Borrar referencia en BD
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    if (updateError) {
      console.error(updateError);
      msg.textContent = "❌ Error quitando avatar en perfil.";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Volver a iniciales
    preview.classList.add("hidden");
    initials.textContent = init;
    initials.classList.remove("hidden");

    // Actualizar header
    if (window.updateHeaderAvatar) {
      window.updateHeaderAvatar(null, nameForInitials);
    }

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  };
}

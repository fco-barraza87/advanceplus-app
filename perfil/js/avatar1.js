// /perfil/js/avatar.js
import { supabase } from "/js/supabase.js";

// Utilidad común: obtener user + profile actualizado
async function getFreshProfile() {
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
  const initialData = await getFreshProfile();
  if (!initialData) return;

  const { user, profile } = initialData;

  // DOM
  const preview   = document.getElementById("avatarPreview");
  const initials  = document.getElementById("avatarInitials");
  const input     = document.getElementById("avatarInput");
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const deleteBtn = document.getElementById("avatarDeleteBtn");
  const msg       = document.getElementById("avatarMsg");

  if (!preview || !initials || !input || !uploadBtn || !deleteBtn || !msg) {
    console.warn("⚠ Elementos de avatar no encontrados en el DOM.");
    return;
  }

  // Iniciales
  const name = profile?.full_name || user.email;
  const init = name.split(" ").map(x => x[0]).join("").substring(0,2).toUpperCase();

  // Mostrar estado inicial
  if (profile?.avatar_url) {
    preview.src = profile.avatar_url;
    preview.classList.remove("hidden");
    initials.classList.add("hidden");
  } else {
    initials.textContent = init;
    initials.classList.remove("hidden");
    preview.classList.add("hidden");
  }

  // Botón subir → abrir input
  uploadBtn.onclick = () => input.click();

  // ------------------------------------------
  // SUBIR AVATAR
  // ------------------------------------------
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    msg.textContent = "Subiendo...";
    msg.style.color = "#fff";

    // Tamaño máximo 2MB
    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ Máximo permitido 2MB.";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Vista previa temporal
    const tempURL = URL.createObjectURL(file);
    preview.src = tempURL;
    preview.classList.remove("hidden");
    initials.classList.add("hidden");

    // Subir a Storage
    const ext = file.name.split(".").pop();
    const filePath = `profiles/${user.id}/avatar.${ext}`;

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

    // Guardar URL en BD
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

    // ------------------------------------------
    // 🔥 Obtener perfil actualizado desde BD
    // ------------------------------------------
    const freshData = await getFreshProfile();
    if (!freshData) return;

    const newAvatarURL = freshData.profile.avatar_url;
    const newName      = freshData.profile.full_name || user.email;

    // Actualizar UI FINAL
    preview.src = newAvatarURL;
    preview.classList.remove("hidden");
    initials.classList.add("hidden");

    // Header
    if (window.updateHeaderAvatar)
      window.updateHeaderAvatar(newAvatarURL, newName);

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

    // Listar archivos
    const { data: files } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (files?.length) {
      const paths = files.map(f => `${folder}/${f.name}`);
      await supabase.storage.from("avatars").remove(paths);
    }

    // Quitar avatar_url de BD
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    // UI inicial
    initials.textContent = init;
    initials.classList.remove("hidden");
    preview.classList.add("hidden");

    if (window.updateHeaderAvatar)
      window.updateHeaderAvatar(null, name);

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  };
}

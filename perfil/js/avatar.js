// /perfil/js/avatar.js
import { supabase } from "/js/supabase.js";

/* ---------------------------------------------------
   VARIABLE GLOBAL PARA EVITAR QUE PERFIL.js 
   RE-RENDERICE EL MÓDULO MIENTRAS SUBES EL AVATAR
--------------------------------------------------- */
window.isUploadingAvatar = false;

// Obtener user + profile
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

  // DOM
  const imgPreview = document.getElementById("avatarPreview");
  const initialsDiv = document.getElementById("avatarInitials");
  const input = document.getElementById("avatarInput");
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const deleteBtn = document.getElementById("avatarDeleteBtn");
  const msg = document.getElementById("avatarMsg");

  if (!imgPreview || !initialsDiv) {
    console.warn("Avatar DOM no encontrado");
    return;
  }

  // Iniciales
  const name = profile?.full_name || user.email;
  const initials = name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Mostrar avatar inicial
  if (profile?.avatar_url) {
    imgPreview.src = profile.avatar_url;
    imgPreview.classList.remove("hidden");
    initialsDiv.classList.add("hidden");
  } else {
    imgPreview.classList.add("hidden");
    initialsDiv.textContent = initials;
    initialsDiv.classList.remove("hidden");
  }

  // Abrir input
  uploadBtn.onclick = () => input.click();

  // ------------------------------
  // SUBIR AVATAR
  // ------------------------------
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    window.isUploadingAvatar = true;

    msg.textContent = "Subiendo...";
    msg.style.color = "#fff";

    const tmp = URL.createObjectURL(file);
    imgPreview.src = tmp;
    imgPreview.classList.remove("hidden");
    initialsDiv.classList.add("hidden");

    const ext = file.name.split(".").pop();
    const path = `profiles/${user.id}/avatar.${ext}`;

    // Subir
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      msg.textContent = "❌ Error subiendo archivo";
      msg.style.color = "#ff6b6b";
      window.isUploadingAvatar = false;
      return;
    }

    // URL pública
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const publicUrl = publicData.publicUrl;

    // Guardar en BD
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      msg.textContent = "❌ Error guardando perfil";
      msg.style.color = "#ff6b6b";
      window.isUploadingAvatar = false;
      return;
    }

    // Actualizar UI
    imgPreview.src = publicUrl;
    imgPreview.classList.remove("hidden");
    initialsDiv.classList.add("hidden");

    // Actualizar header
    if (window.updateHeaderAvatar) {
      window.updateHeaderAvatar(publicUrl, name);
    }

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";

    window.isUploadingAvatar = false;
  };

  // ------------------------------
  // ELIMINAR AVATAR
  // ------------------------------
  deleteBtn.onclick = async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;

    const { data: files } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (files?.length) {
      const paths = files.map((f) => `${folder}/${f.name}`);
      await supabase.storage.from("avatars").remove(paths);
    }

    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    imgPreview.classList.add("hidden");
    initialsDiv.textContent = initials;
    initialsDiv.classList.remove("hidden");

    if (window.updateHeaderAvatar) {
      window.updateHeaderAvatar(null, name);
    }

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  };
}

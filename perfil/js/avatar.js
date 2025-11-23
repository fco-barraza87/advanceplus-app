// -------------------------------------------------------
//  /perfil/js/avatar.js — versión FINAL
// -------------------------------------------------------
import { supabase } from "/js/supabase.js";

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

  const preview = document.getElementById("avatarPreview");
  const initialsDiv = document.getElementById("avatarInitials");
  const input = document.getElementById("avatarInput");
  const msg = document.getElementById("avatarMsg");

  // Iniciales
  const nameForInitials = profile?.full_name || user.email;
  const initials = nameForInitials
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Mostrar avatar si existe
  if (profile?.avatar_url) {
    preview.src = profile.avatar_url;
    preview.style.display = "block";
    initialsDiv.style.display = "none";
  } else {
    initialsDiv.textContent = initials;
    initialsDiv.style.display = "flex";
    preview.style.display = "none";
  }

  //-------------------------------------------------------
  // SUBIR AVATAR
  //-------------------------------------------------------
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ Máximo 2MB";
      msg.style.color = "#ff6b6b";
      return;
    }

    msg.textContent = "Subiendo...";
    msg.style.color = "#fff";

    const ext = file.name.split(".").pop();
    const filePath = `profiles/${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      msg.textContent = "❌ Error al subir";
      msg.style.color = "#ff6b6b";
      return;
    }

    // URL pública limpia
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Guardamos en DB
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    // UI
    preview.src = publicUrl;
    preview.style.display = "block";
    initialsDiv.style.display = "none";

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";

    // 🔥 Actualizar header dinámicamente
    window.updateHeaderAvatar(publicUrl, profile?.full_name || user.email);
  };

  //-------------------------------------------------------
  // ELIMINAR AVATAR
  //-------------------------------------------------------
  document.getElementById("avatarDeleteBtn").onclick = async () => {
    msg.textContent = "Eliminando...";

    const folder = `profiles/${user.id}`;

    const { data: files } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (files) {
      for (const f of files) {
        await supabase.storage.from("avatars").remove([`${folder}/${f.name}`]);
      }
    }

    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    preview.style.display = "none";
    initialsDiv.textContent = initials;
    initialsDiv.style.display = "flex";

    msg.textContent = "✔ Eliminado";
    msg.style.color = "#3ee98a";

    // 🔥 Actualizar header dinámicamente
    window.updateHeaderAvatar(null, profile?.full_name || user.email);
  };
}

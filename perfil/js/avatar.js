//-------------------------------------------------------
//  /perfil/js/avatar.js  — versión corregida
//-------------------------------------------------------

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
  const initialsEl = document.getElementById("avatarInitials");
  const input = document.getElementById("avatarInput");
  const msg = document.getElementById("avatarMsg");

  // Iniciales
  const name = profile?.full_name || user.email;
  const initials = name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  function renderAvatar(url) {
    if (url) {
      preview.src = url;
      preview.style.display = "block";
      initialsEl.style.display = "none";
    } else {
      preview.style.display = "none";
      initialsEl.textContent = initials;
      initialsEl.style.display = "block";
    }
  }

  renderAvatar(profile?.avatar_url);

  //------------------------------------------
  //  Subir avatar
  //------------------------------------------
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    msg.textContent = "Subiendo...";

    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ Máximo permitido 2MB.";
      msg.style.color = "#f55";
      return;
    }

    const ext = file.name.split(".").pop();
    const filePath = `profiles/${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      msg.textContent = "❌ Error al subir.";
      msg.style.color = "#f55";
      return;
    }

    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const url = publicData.publicUrl;

    await supabase
      .from("profiles")
      .update({ avatar_url: url, updated_at: new Date() })
      .eq("id", user.id);

    renderAvatar(url);

    // 🔥 Actualizar el header dinámicamente
    window.updateHeaderAvatar(url, name);

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  };

  //------------------------------------------
  //  Eliminar avatar
  //------------------------------------------
  document.getElementById("avatarDeleteBtn").onclick = async () => {
    msg.textContent = "Eliminando...";

    const folder = `profiles/${user.id}`;
    const { data: files } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (files) {
      for (const f of files) {
        await supabase.storage
          .from("avatars")
          .remove([`${folder}/${f.name}`]);
      }
    }

    await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date() })
      .eq("id", user.id);

    renderAvatar(null);

    // 🔥 Actualizar header
    window.updateHeaderAvatar(null, name);

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  };
}

// ============================================================
//  AVATAR MODULE — Advance+
// ============================================================

import { supabase } from "/js/supabase.js";

/**
 * Obtener usuario + perfil
 */
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

/**
 * Inicializar módulo Avatar
 */
export async function initAvatar() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  // Elementos del DOM
  const avatarPreview = document.getElementById("avatarPreview");
  const avatarInitials = document.getElementById("avatarInitials");
  const uploadInput = document.getElementById("avatarInput");
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const deleteBtn = document.getElementById("avatarDeleteBtn");
  const msg = document.getElementById("avatarMsg");

  // Iniciales del usuario
  const initials = (profile?.full_name || user.email)
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // ============================================================
  // MOSTRAR AVATAR INICIAL
  // ============================================================
  if (profile?.avatar_url) {
    avatarPreview.style.display = "block";
    avatarPreview.src = profile.avatar_url;
    avatarInitials.style.display = "none";
  } else {
    avatarPreview.style.display = "none";
    avatarInitials.style.display = "flex";
    avatarInitials.textContent = initials;
  }

  // ============================================================
  // SUBIR NUEVO AVATAR
  // ============================================================
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    msg.textContent = "Cargando…";
    msg.style.color = "#fff";

    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ La imagen excede 2MB";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Vista previa inmediata
    avatarPreview.src = URL.createObjectURL(file);
    avatarPreview.style.display = "block";
    avatarInitials.style.display = "none";

    const ext = file.name.split(".").pop();
    const fileName = `avatar.${ext}`;
    const filePath = `profiles/${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      msg.textContent = "❌ Error subiendo avatar";
      msg.style.color = "#ff6b6b";
      return;
    }

    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Guardar en BD
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  });

  // ============================================================
  // ELIMINAR AVATAR
  // ============================================================
  deleteBtn.addEventListener("click", async () => {
    msg.textContent = "Eliminando…";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;

    const { data: files } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (files?.length) {
      for (const f of files) {
        await supabase.storage
          .from("avatars")
          .remove([`${folder}/${f.name}`]);
      }
    }

    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    avatarPreview.style.display = "none";
    avatarInitials.style.display = "flex";
    avatarInitials.textContent = initials;

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  });
}

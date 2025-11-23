// ============================================================
//  AVATAR MODULE — Advance+
// ============================================================

import { supabase } from "/js/supabase.js";

/**
 * Utilidad para obtener usuario + perfil
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
  const uploadInput = document.getElementById("avatarInput");
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const deleteBtn = document.getElementById("avatarDeleteBtn");
  const msg = document.getElementById("avatarMsg");

  // Mostrar avatar actual
  if (profile?.avatar_url) {
    avatarPreview.src = profile.avatar_url;
  }

  // ============================================================
  //  SUBIR NUEVO AVATAR
  // ============================================================

  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    msg.textContent = "Cargando...";
    msg.style.color = "#fff";

    // Validar tamaño (2 MB)
    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ La imagen excede 2MB";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Vista previa (sin esperar upload)
    const previewUrl = URL.createObjectURL(file);
    avatarPreview.src = previewUrl;

    // Mantener nombre consistente
    const ext = file.name.split(".").pop();
    const fileName = `avatar.${ext}`;

    const filePath = `profiles/${user.id}/${fileName}`;

    // Subir al bucket "avatars"
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      msg.textContent = "❌ Error subiendo avatar";
      msg.style.color = "#ff6b6b";
      console.error(uploadError);
      return;
    }

    // Obtener URL pública
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Actualizar en BD
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      msg.textContent = "❌ Error guardando en perfil";
      msg.style.color = "#ff6b6b";
      return;
    }

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  });

  // ============================================================
  //  BORRAR AVATAR
  // ============================================================

  deleteBtn.addEventListener("click", async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    // Borrar archivo en bucket
    const folder = `profiles/${user.id}`;

    const { data: list } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (list?.length) {
      for (const file of list) {
        await supabase.storage
          .from("avatars")
          .remove([`${folder}/${file.name}`]);
      }
    }

    // Quitar URL en BD
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    if (updateError) {
      msg.textContent = "❌ Error quitando avatar";
      msg.style.color = "#ff6b6b";
      return;
    }

    avatarPreview.src = "/img/avatar-placeholder.png"; // Puedes dejar vacío
    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  });
}

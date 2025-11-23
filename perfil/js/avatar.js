// ============================================================
//  AVATAR MODULE — Advance+ (versión deluxe)
// ============================================================

import { supabase } from "/js/supabase.js";

/**
 * Obtener info del usuario + perfil
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
 * Genera iniciales desde nombre o email
 */
function getInitials(profile, user) {
  const base = profile?.full_name || user.email;
  return base
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/**
 * Mostrar avatar correcto
 */
function renderAvatar(profile, user) {
  const img = document.getElementById("avatarPreview");
  const initialsBox = document.getElementById("avatarInitials");

  if (!img || !initialsBox) return;

  if (profile?.avatar_url) {
    // Mostrar foto
    img.src = profile.avatar_url;
    img.style.display = "block";
    initialsBox.style.display = "none";
  } else {
    // Mostrar iniciales
    const initials = getInitials(profile, user);
    initialsBox.textContent = initials;

    img.style.display = "none";
    initialsBox.style.display = "flex";
  }
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

  // Render inicial (foto o iniciales)
  renderAvatar(profile, user);

  // ============================================================
  //  SUBIR NUEVO AVATAR
  // ============================================================

  uploadBtn.addEventListener("click", () => uploadInput.click());

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

    // Vista previa instantánea
    avatarPreview.src = URL.createObjectURL(file);
    avatarPreview.style.display = "block";
    avatarInitials.style.display = "none";

    // Mantener nombre único
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
      renderAvatar(profile, user); // revertir a estado anterior
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
      msg.textContent = "❌ Error guardando en BD";
      msg.style.color = "#ff6b6b";
      return;
    }

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  });

  // ============================================================
  //  ELIMINAR AVATAR
  // ============================================================

  deleteBtn.addEventListener("click", async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;

    // Listar archivos del usuario
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

    // Quitar URL de BD
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    if (updateError) {
      msg.textContent = "❌ Error quitando avatar";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Mostrar iniciales nuevamente
    avatarPreview.style.display = "none";
    avatarInitials.style.display = "flex";
    avatarInitials.textContent = getInitials(profile, user);

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  });
}

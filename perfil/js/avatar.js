// ============================================================
//  AVATAR MODULE — Advance+
// ============================================================

import { supabase } from "/js/supabase.js";

// Obtener usuario + perfil
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

// ============================================================
//   INICIALIZAR MODULO AVATAR
// ============================================================
export async function initAvatar() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  const avatarPreview = document.getElementById("avatarPreview");
  const avatarInitials = document.getElementById("avatarInitials");
  const uploadInput = document.getElementById("avatarInput");
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const deleteBtn = document.getElementById("avatarDeleteBtn");
  const msg = document.getElementById("avatarMsg");

  // ============================================================
  //   MOSTRAR AVATAR ACTUAL
  // ============================================================

  if (profile?.avatar_url) {
    avatarPreview.src = profile.avatar_url;
    avatarPreview.style.display = "block";
    avatarInitials.style.display = "none";
  } else {
    avatarPreview.src = "";
    avatarPreview.style.display = "none";

    const initials = (profile.full_name || user.email)
      .split(" ")
      .map((x) => x[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    avatarInitials.textContent = initials;
    avatarInitials.style.display = "flex";
  }

  // Al hacer clic → abrir input file
  uploadBtn.addEventListener("click", () => uploadInput.click());

  // ============================================================
  //   SUBIR NUEVO AVATAR
  // ============================================================

  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    msg.textContent = "Cargando...";
    msg.style.color = "#fff";

    // Tamaño máximo
    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ Máximo permitido: 2MB";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Mostrar preview inmediata
    avatarPreview.src = URL.createObjectURL(file);
    avatarPreview.style.display = "block";
    avatarInitials.style.display = "none";

    // Nombre estándar
    const ext = file.name.split(".").pop();
    const fileName = `avatar.${ext}`;
    const filePath = `profiles/${user.id}/${fileName}`;

    // SUBIR A STORAGE
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      msg.textContent = "❌ No se pudo subir el avatar";
      msg.style.color = "#ff6b6b";
      return;
    }

    // URL pública definitiva
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Guardar en DB
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

    // Recargar header para mostrarlo arriba
    if (window.updateHeaderAvatar) {
      updateHeaderAvatar(publicUrl);
    }
  });

  // ============================================================
  //   ELIMINAR AVATAR
  // ============================================================

  deleteBtn.addEventListener("click", async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;
    const { data: files } = await supabase.storage.from("avatars").list(folder);

    if (files?.length) {
      await supabase.storage
        .from("avatars")
        .remove(files.map((f) => `${folder}/${f.name}`));
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    if (updateError) {
      msg.textContent = "❌ Error quitando avatar";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Volver a iniciales
    const initials = (profile.full_name || user.email)
      .split(" ")
      .map((x) => x[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    avatarPreview.src = "";
    avatarPreview.style.display = "none";

    avatarInitials.textContent = initials;
    avatarInitials.style.display = "flex";

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";

    // Actualizar header
    if (window.updateHeaderAvatar) {
      updateHeaderAvatar(null);
    }
  });
}

// ============================================================
//  AVATAR MODULE — Advance+ (Duolingo-style)
// ============================================================

import { supabase } from "/js/supabase.js";

// Utilidad para obtener usuario + perfil
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
  const avatarPreview = document.getElementById("avatarPreview");
  const avatarInitials = document.getElementById("avatarInitials");
  const uploadInput = document.getElementById("avatarInput");
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const deleteBtn = document.getElementById("avatarDeleteBtn");
  const msg = document.getElementById("avatarMsg");

  // Iniciales si no hay avatar
  const initials = (profile.full_name || user.email)
    .split(" ")
    .map(x => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Mostrar avatar actual o iniciales
  if (profile.avatar_url) {
    avatarPreview.src = profile.avatar_url;
    avatarInitials.style.display = "none";
  } else {
    avatarPreview.src = "";
    avatarInitials.textContent = initials;
    avatarInitials.style.display = "flex";
  }

  // ======================================
  // CLICK → Abrir selector de archivo
  // ======================================
  uploadBtn.addEventListener("click", () => uploadInput.click());

  // ======================================
  // SUBIR AVATAR
  // ======================================
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    msg.textContent = "Cargando...";
    msg.style.color = "#fff";

    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ La imagen excede 2MB";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Previsualización instantánea
    avatarPreview.src = URL.createObjectURL(file);
    avatarInitials.style.display = "none";

    const ext = file.name.split(".").pop();
    const fileName = `avatar.${ext}`;
    const filePath = `profiles/${user.id}/${fileName}`;

    // subir al bucket
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      msg.textContent = "❌ Error subiendo avatar";
      msg.style.color = "#ff6b6b";
      return;
    }

    // obtener URL pública
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // guardar en profiles
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  });

  // ======================================
  // ELIMINAR AVATAR
  // ======================================
  deleteBtn.addEventListener("click", async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;
    const { data: list } = await supabase.storage.from("avatars").list(folder);

    if (list?.length) {
      for (const file of list) {
        await supabase.storage
          .from("avatars")
          .remove([`${folder}/${file.name}`]);
      }
    }

    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    avatarPreview.src = "";
    avatarInitials.textContent = initials;
    avatarInitials.style.display = "flex";

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  });
}

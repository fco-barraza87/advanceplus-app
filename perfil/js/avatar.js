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
  const initials = document.getElementById("avatarInitials");
  const input = document.getElementById("avatarInput");
  const msg = document.getElementById("avatarMsg");

  // GENERAR INICIALES
  const nameForInitials = profile?.full_name || user.email;
  const init = nameForInitials
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Mostrar avatar o iniciales
  if (profile?.avatar_url) {
    preview.src = profile.avatar_url;
    preview.style.display = "block";
    initials.style.display = "none";
  } else {
    preview.style.display = "none";
    initials.textContent = init;
    initials.style.display = "block";
  }

  // ============================
  // SUBIR AVATAR
  // ============================

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

    // SUBIR
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      msg.textContent = "❌ Error al subir.";
      msg.style.color = "#f55";
      return;
    }

    // OBTENER URL
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // GUARDAR EN BD
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    // MOSTRAR EN UI
    preview.src = publicUrl;
    preview.style.display = "block";
    initials.style.display = "none";

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  };

  // ============================
  // ELIMINAR
  // ============================

  document.getElementById("avatarDeleteBtn").onclick = async () => {
    msg.textContent = "Eliminando...";

    const folder = `profiles/${user.id}`;

    const { data: files } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (files) {
      for (const file of files) {
        await supabase.storage
          .from("avatars")
          .remove([`${folder}/${file.name}`]);
      }
    }

    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    preview.style.display = "none";
    initials.textContent = init;
    initials.style.display = "block";

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  };
}

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

// Generar iniciales
function initialsFrom(str) {
  return str
    .split(" ")
    .map(w => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

// Mostrar solo foto
function showImage(url) {
  const img = document.getElementById("avatarImage");
  const initials = document.getElementById("avatarInitials");

  initials.classList.add("hidden");
  img.classList.remove("hidden");
  img.src = url;
}

// Mostrar iniciales
function showInitials(text) {
  const img = document.getElementById("avatarImage");
  const initials = document.getElementById("avatarInitials");

  img.classList.add("hidden");
  initials.classList.remove("hidden");
  initials.textContent = text;
}

export async function initAvatar() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;
  const msg = document.getElementById("avatarMsg");
  const input = document.getElementById("avatarInput");
  const deleteBtn = document.getElementById("avatarDeleteBtn");

  // Mostrar avatar inicial
  if (profile?.avatar_url) {
    showImage(profile.avatar_url);
  } else {
    showInitials(initialsFrom(profile?.full_name || user.email));
  }

  // =====================================================
  // SUBIR AVATAR
  // =====================================================
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    msg.textContent = "Cargando...";
    msg.style.color = "#fff";

    // Validar tamaño
    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ Máximo 2MB";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Previsualización instantánea
    showImage(URL.createObjectURL(file));

    const ext = file.name.split(".").pop();
    const fileName = `avatar.${ext}`;
    const filePath = `profiles/${user.id}/${fileName}`;

    // Upload
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      msg.textContent = "❌ Error al subir";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Obtener URL pública
    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // Guardar en BD
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      msg.textContent = "❌ Error guardando";
      msg.style.color = "#ff6b6b";
      return;
    }

    msg.textContent = "✔ Avatar actualizado";
    msg.style.color = "#3ee98a";
  });

  // =====================================================
  // ELIMINAR AVATAR
  // =====================================================

  deleteBtn.addEventListener("click", async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;

    // Listar y borrar archivos
    const { data: list } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (list?.length) {
      await Promise.all(
        list.map(f =>
          supabase.storage.from("avatars")
            .remove([`${folder}/${f.name}`])
        )
      );
    }

    // Limpiar BD
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    // Mostrar iniciales
    showInitials(initialsFrom(profile?.full_name || user.email));

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  });
}

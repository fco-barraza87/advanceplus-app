import { supabase } from "/js/supabase.js";

/* ===============================
   OBTENER PERFIL
================================ */
async function getProfile() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  return { user: session.user, profile };
}

/* ===============================
   MOSTRAR AVATAR
================================ */
function renderAvatar(url, initials) {
  const preview = document.getElementById("avatarPreview");
  if (!preview) return;

  preview.innerHTML = "";

  if (url) {
    const img = document.createElement("img");
    img.src = url;
    preview.appendChild(img);
  } else {
    preview.textContent = initials;
  }
}

/* ===============================
   REDIMENSIONAR IMAGEN 400x400
================================ */
function resizeImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        canvas.width = 400;
        canvas.height = 400;

        ctx.drawImage(img, 0, 0, 400, 400);
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/jpeg",
          0.9
        );
      };
      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}

/* ===============================
   SUBIR AVATAR
================================ */
async function uploadAvatar(userId, fileBlob) {
  const filename = `${userId}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filename, fileBlob, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (uploadError) return null;

  const { data: publicURL } = supabase.storage
    .from("avatars")
    .getPublicUrl(filename);

  return publicURL.publicUrl || null;
}

/* ===============================
   ELIMINAR AVATAR
================================ */
async function deleteAvatarFromBucket(url) {
  try {
    const parts = url.split("/");
    const filename = parts[parts.length - 1];

    await supabase.storage
      .from("avatars")
      .remove([filename]);
  } catch {}
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const avatarInput = document.getElementById("avatarInput");
  const avatarMsg = document.getElementById("avatarMsg");
  const btnDelete = document.getElementById("avatarDelete");

  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  const initials = (profile.full_name || user.email)
    .split(" ")
    .map(x => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  renderAvatar(profile.avatar_url, initials);

  /* ==============
     SUBIR AVATAR
  =============== */
  avatarInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    avatarMsg.textContent = "Procesando imagen…";

    if (file.size > 2 * 1024 * 1024) {
      avatarMsg.textContent = "❌ Tamaño máximo 2MB";
      avatarMsg.style.color = "#ff6b6b";
      return;
    }

    // Redimensionar
    const resized = await resizeImage(file);

    // Subir
    const newUrl = await uploadAvatar(user.id, resized);

    if (!newUrl) {
      avatarMsg.textContent = "❌ Error subiendo imagen";
      avatarMsg.style.color = "#ff6b6b";
      return;
    }

    // Eliminar avatar anterior del bucket
    if (profile.avatar_url) {
      await deleteAvatarFromBucket(profile.avatar_url);
    }

    // Guardar en DB
    await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("id", user.id);

    avatarMsg.textContent = "✔ Imagen actualizada";
    avatarMsg.style.color = "#3ee98a";

    renderAvatar(newUrl, initials);
  };

  /* ==============
     ELIMINAR AVATAR
  =============== */
  btnDelete.onclick = async () => {
    if (!profile.avatar_url) {
      avatarMsg.textContent = "No tienes avatar para eliminar";
      return;
    }

    avatarMsg.textContent = "Eliminando…";

    await deleteAvatarFromBucket(profile.avatar_url);

    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    avatarMsg.textContent = "✔ Avatar eliminado";
    avatarMsg.style.color = "#3ee98a";

    renderAvatar(null, initials);
  };
});

import { supabase } from "/js/supabase.js";

/* ===============================
   Cargar avatar actual
================================ */
export async function initAvatar() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const avatarPreview = document.getElementById("avatarPreview");
  const avatarInput = document.getElementById("avatarInput");
  const btnUpload = document.getElementById("btnUploadAvatar");
  const btnDelete = document.getElementById("btnDeleteAvatar");
  const statusEl = document.getElementById("avatarStatus");

  const defaultAvatar = "/img/default-avatar.png";

  // Mostrar avatar actual
  avatarPreview.src = profile?.avatar_url || defaultAvatar;

  /* ===============================
     Subir nueva foto
  ================================= */
  btnUpload.onclick = () => avatarInput.click();

  avatarInput.onchange = async () => {
    const file = avatarInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      statusEl.textContent = "❌ Tamaño máximo: 2MB";
      statusEl.style.color = "#ff6b6b";
      return;
    }

    statusEl.textContent = "Subiendo imagen...";
    statusEl.style.color = "#fff";

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Subir a Supabase Storage (reemplaza si ya existe)
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      statusEl.textContent = "❌ Error subiendo la imagen";
      statusEl.style.color = "#ff6b6b";
      return;
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const newUrl = publicUrlData.publicUrl;

    // Guardar en la tabla profiles
    await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("id", user.id);

    avatarPreview.src = newUrl;
    statusEl.textContent = "✔ Avatar actualizado";
    statusEl.style.color = "#3ee98a";
  };

  /* ===============================
     Eliminar avatar
  ================================= */
  btnDelete.onclick = async () => {
    statusEl.textContent = "Eliminando avatar...";
    statusEl.style.color = "#fff";

    // Borrar archivo del bucket
    await supabase.storage
      .from("avatars")
      .remove([`${user.id}/${user.id}.jpg`, `${user.id}/${user.id}.png`]);

    // Reset en BD
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    avatarPreview.src = defaultAvatar;

    statusEl.textContent = "✔ Avatar eliminado";
    statusEl.style.color = "#3ee98a";
  };
}

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
 * Generar iniciales
 */
function generateInitials(str) {
  return str
    .split(" ")
    .map(s => s[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
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

  if (!avatarPreview || !uploadInput || !uploadBtn || !deleteBtn) {
    console.error("⚠ Error: elementos del DOM no encontrados en avatar.html");
    return;
  }

  // ============================================================
  //   MOSTRAR AVATAR ACTUAL
  // ============================================================

  if (profile?.avatar_url) {
    avatarPreview.src = profile.avatar_url;
  } else {
    // ❗ Si NO hay avatar → mostrar iniciales dinámicamente
    const initials = generateInitials(profile?.full_name || user.email);
    avatarPreview.style.objectFit = "contain";
    avatarPreview.style.background = "var(--ap-gold)";
    avatarPreview.style.color = "#0A0F1C";
    avatarPreview.style.fontSize = "48px";
    avatarPreview.style.fontWeight = "700";
    avatarPreview.style.display = "flex";
    avatarPreview.style.alignItems = "center";
    avatarPreview.style.justifyContent = "center";
    avatarPreview.src = "";
    avatarPreview.alt = initials;
    avatarPreview.dataset.initials = initials;
    avatarPreview.innerText = initials;
  }

  // ============================================================
  //  SUBIR NUEVO AVATAR
  // ============================================================

  uploadBtn.addEventListener("click", () => {
    uploadInput.click();
  });

  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    msg.textContent = "Cargando...";
    msg.style.color = "#fff";

    // Validar tamaño 2MB
    if (file.size > 2 * 1024 * 1024) {
      msg.textContent = "❌ La imagen excede 2MB";
      msg.style.color = "#ff6b6b";
      return;
    }

    // Previsualización inmediata
    avatarPreview.src = URL.createObjectURL(file);
    avatarPreview.removeAttribute("data-initials");
    avatarPreview.style.objectFit = "cover";

    // Nombre consistente
    const ext = file.name.split(".").pop();
    const fileName = `avatar.${ext}`;
    const filePath = `profiles/${user.id}/${fileName}`;

    // Subir archivo
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

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
  });

  // ============================================================
  //  BORRAR AVATAR
  // ============================================================

  deleteBtn.addEventListener("click", async () => {
    msg.textContent = "Eliminando...";
    msg.style.color = "#fff";

    const folder = `profiles/${user.id}`;

    // Listar archivos dentro de la carpeta
    const { data: list } = await supabase.storage
      .from("avatars")
      .list(folder);

    if (list?.length) {
      for (const file of list) {
        await supabase.storage.from("avatars").remove([`${folder}/${file.name}`]);
      }
    }

    // Remover URL en BD
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
    const initials = generateInitials(profile?.full_name || user.email);
    avatarPreview.src = "";
    avatarPreview.style.background = "var(--ap-gold)";
    avatarPreview.style.color = "#0A0F1C";
    avatarPreview.style.fontSize = "48px";
    avatarPreview.innerText = initials;

    msg.textContent = "✔ Avatar eliminado";
    msg.style.color = "#3ee98a";
  });
}

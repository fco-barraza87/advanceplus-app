import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";
import { loadUserHeader } from "/components/user-header.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;
  const user = session.user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error cargando perfil:", error);
    return;
  }

  // ---- HELPERS ----
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };
  const setSwitch = (id, v) => { document.getElementById(id).checked = !!v; };

  // ---- RELLENAR CAMPOS ----
  set("input_fullname", profile.full_name);
  set("input_birthdate", profile.birthdate);
  set("input_gender", profile.gender);
  set("input_phone", profile.phone);
  set("input_country", profile.country);
  set("input_language", profile.language);
  set("input_timezone", profile.timezone);
  set("input_focus", profile.preferred_focus_time);

  const notif = profile.notifications || {};
  setSwitch("notif_racha", notif.notifRacha);
  setSwitch("notif_privNombre", notif.privNombre);
  setSwitch("notif_tema", notif.temaVisual === "auto");

  const goals = profile.goals_json || {};
  setSwitch("goal_disciplina", goals.disciplina);
  setSwitch("goal_foco", goals.foco);
  setSwitch("goal_energia", goals.energia);

  // SOLO LECTURA
  document.getElementById("p_email").textContent = profile.email;
  document.getElementById("p_created").textContent =
    new Date(profile.created_at).toLocaleDateString();

  // Mostrar avatar actual
  if (profile.avatar_url) {
    document.getElementById("avatarPreview").src = profile.avatar_url;
  }

  const avatarPreview = document.getElementById("avatarPreview");

  // Sincronizar con el avatar del header (para evitar 404 y mantener consistencia)
  const headerAvatarImg = document.querySelector(".ap-header-avatar img");
  if (headerAvatarImg && headerAvatarImg.src) {
    avatarPreview.src = headerAvatarImg.src;
  } else if (profile.avatar_url) {
    avatarPreview.src = profile.avatar_url;
  }


let cropper = null;
const avatarInput = document.getElementById("avatarInput");
const avatarModal = document.getElementById("avatarModal");
const avatarCropImage = document.getElementById("avatarCropImage");
const avatarPreview = document.getElementById("avatarPreview");

avatarInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validar tamaño
  if (file.size > 2 * 1024 * 1024) {
    alert("La imagen no puede superar los 2 MB.");
    avatarInput.value = "";
    return;
  }

  // Mostrar imagen en modal para recorte
  const url = URL.createObjectURL(file);
  avatarCropImage.src = url;

  avatarCropImage.onload = () => {
    // Mostrar modal
    avatarModal.classList.remove("hidden");

    // Destruir cropper anterior si existía
    if (cropper) {
      cropper.destroy();
    }

    // Crear nuevo cropper (1:1 estilo Instagram)
    cropper = new Cropper(avatarCropImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      background: false,
      autoCropArea: 1,
    });
  };
});

// Botón cancelar recorte
document.getElementById("avatarCropCancel").addEventListener("click", () => {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  avatarModal.classList.add("hidden");
  avatarInput.value = "";
});

// Botón aplicar recorte
document.getElementById("avatarCropApply").addEventListener("click", async () => {
  if (!cropper) return;

  // 1. Canvas recortado 400x400
  const croppedCanvas = cropper.getCroppedCanvas({
    width: 400,
    height: 400,
  });

  // 2. Aplicar filtro "Estilo Advance+"
  //    Suavizar / quitar ruido (ligero blur) + brillo/contraste/saturación
  const filteredCanvas = document.createElement("canvas");
  filteredCanvas.width = 400;
  filteredCanvas.height = 400;
  const fctx = filteredCanvas.getContext("2d");

  fctx.filter = "brightness(1.05) contrast(1.06) saturate(1.04) blur(0.3px)";
  fctx.drawImage(croppedCanvas, 0, 0, 400, 400);

  filteredCanvas.toBlob(async (blob) => {
    if (!blob) {
      alert("Error procesando la imagen.");
      return;
    }

    // Nombre único
    const fileName = `${user.id}_${Date.now()}.jpg`;

    // Subir a Supabase Storage (mismo bucket "avatars")
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, blob, { upsert: true });

    if (uploadError) {
      alert("Error subiendo avatar.");
      console.error(uploadError);
      return;
    }

    // Obtener URL pública
    const { data: publicUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    // Guardar en profiles
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl.publicUrl })
      .eq("id", user.id);

    if (updateError) {
      alert("Error guardando avatar.");
      console.error(updateError);
      return;
    }

    // Set preview + actualizar header
    avatarPreview.src = publicUrl.publicUrl;
    loadUserHeader();

    // Cerrar modal y limpiar
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    avatarModal.classList.add("hidden");
    avatarInput.value = "";
  }, "image/jpeg", 0.9); // calidad 90%
});


  document.getElementById("avatarDelete").addEventListener("click", async () => {
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    // Fallback: usa el placeholder del header o deja vacío
    const headerAvatarImg = document.querySelector(".ap-header-avatar img");
    if (headerAvatarImg && headerAvatarImg.src) {
      avatarPreview.src = headerAvatarImg.src;
    } else {
      avatarPreview.src = "";
    }

    loadUserHeader();
  });



  // ---- GUARDAR CAMBIOS ----
  document.getElementById("saveProfileBtn").addEventListener("click", async () => {

    const updates = {
      full_name: document.getElementById("input_fullname").value.trim(),
      birthdate: document.getElementById("input_birthdate").value || null,
      gender: document.getElementById("input_gender").value || null,
      phone: document.getElementById("input_phone").value.trim(),
      country: document.getElementById("input_country").value.trim(),
      language: document.getElementById("input_language").value,
      timezone: document.getElementById("input_timezone").value.trim(),
      preferred_focus_time: document.getElementById("input_focus").value.trim(),

      notifications: {
        notifRacha: document.getElementById("notif_racha").checked,
        privNombre: document.getElementById("notif_privNombre").checked,
        temaVisual: document.getElementById("notif_tema").checked ? "auto" : "manual"
      },

      goals_json: {
        disciplina: document.getElementById("goal_disciplina").checked,
        foco: document.getElementById("goal_foco").checked,
        energia: document.getElementById("goal_energia").checked
      },

      updated_at: new Date(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    const msg = document.getElementById("saveMessage");

    if (updateError) {
      msg.textContent = "❌ Error al guardar";
      msg.style.color = "#ff6b6b";
      console.error(updateError);
      return;
    }

    msg.textContent = "✔ Cambios guardados correctamente";
    msg.style.color = "#3ee98a";

    loadUserHeader();
  });
});

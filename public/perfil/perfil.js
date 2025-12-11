// /perfil/perfil.js
import { supabase } from "/js/supabase.js";
import { protectPage } from "/js/router.js";
import { getCurrentUserWithProfile, logout } from "/js/auth.js";
import { loadHeader } from "/components/header.js";

/* ============================================================
   INIT — Protege la página y carga datos del usuario
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await protectPage({ allowedRoles: ["user", "coach", "admin"] });

  const data = await getCurrentUserWithProfile();
  if (!data || !data.profile) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { user, profile } = data;

  console.log("[perfil] Loaded profile:", profile);

  await loadHeader();
  loadProfile(profile);
  setupAvatarUploader(user, profile);
  setupSaveButton(user);
});

/* ============================================================
   CARGAR DATOS DEL PERFIL
============================================================ */
function loadProfile(profile) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  };

  const setSwitch = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };

  // ---- Datos personales ----
  set("input_fullname", profile.full_name);
  set("input_birthdate", profile.birthdate);
  set("input_gender", profile.gender);
  set("input_phone", profile.phone);
  set("input_country", profile.country);
  set("input_language", profile.language);
  set("input_timezone", profile.timezone);
  set("input_focus", profile.preferred_focus_time);

  // ---- Notificaciones ----
  const notif = profile.notifications || {};
  setSwitch("notif_racha", notif.notifRacha);
  setSwitch("notif_privNombre", notif.privNombre);
  setSwitch("notif_tema", notif.temaVisual === "auto");

  // ---- Objetivos ----
  const goals = profile.goals_json || {};
  setSwitch("goal_disciplina", goals.disciplina);
  setSwitch("goal_foco", goals.foco);
  setSwitch("goal_energia", goals.energia);

  // ---- Email + fecha creación ----
  document.getElementById("p_email").textContent = profile.email || "";
  document.getElementById("p_created").textContent =
    new Date(profile.created_at).toLocaleDateString();

  // ---- Avatar ----
  const avatarPreview = document.getElementById("avatarPreview");

  if (profile.avatar_url) {
    avatarPreview.src = profile.avatar_url;
  } else {
    avatarPreview.src = "/img/default-avatar.png";
  }
}

/* ============================================================
   AVATAR — Subir, recortar, guardar
============================================================ */
function setupAvatarUploader(user, profile) {
  let cropper = null;

  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");
  const avatarModal = document.getElementById("avatarModal");
  const avatarCropImage = document.getElementById("avatarCropImage");

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen no puede superar 2 MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    avatarCropImage.src = url;

    avatarModal.classList.remove("hidden");

    if (cropper) cropper.destroy();

    cropper = new Cropper(avatarCropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      background: false,
    });
  });

  document.getElementById("avatarCropCancel").onclick = () => {
    cropper?.destroy();
    cropper = null;
    avatarInput.value = "";
    avatarModal.classList.add("hidden");
  };

  document.getElementById("avatarCropApply").onclick = async () => {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });

    canvas.toBlob(async (blob) => {
      const fileName = `${user.id}_${Date.now()}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { upsert: true });

      if (uploadErr) {
        console.error(uploadErr);
        alert("Error subiendo avatar.");
        return;
      }

      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Guardar en BD
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl.publicUrl })
        .eq("id", user.id);

      avatarPreview.src = publicUrl.publicUrl;

      await loadHeader();

      cropper.destroy();
      avatarModal.classList.add("hidden");
      avatarInput.value = "";
    }, "image/jpeg", 0.9);
  };

  document.getElementById("avatarDelete").onclick = async () => {
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    avatarPreview.src = "/img/default-avatar.png";
    await loadHeader();
  };
}

/* ============================================================
   GUARDAR PERFIL
============================================================ */
function setupSaveButton(user) {
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

      updated_at: new Date().toISOString(),
    };

    const msg = document.getElementById("saveMessage");

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      msg.textContent = "❌ Error al guardar";
      msg.style.color = "#ff6b6b";
      console.error(error);
      return;
    }

    msg.textContent = "✔ Cambios guardados";
    msg.style.color = "#3ee98a";
  });
}

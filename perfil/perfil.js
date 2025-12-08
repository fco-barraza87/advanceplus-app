// /perfil/perfil.js
import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";
import { loadHeader } from "/components/header.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();
  loadHeader();

  /* ----------------------------------------------------
     1) Obtener usuario autenticado
  ---------------------------------------------------- */
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) {
    alert("Tu sesión expiró. Inicia sesión nuevamente.");
    window.location.href = "/auth/login.html";
    return;
  }

  const user = session.user;
  const userId = user.id;

  /* ----------------------------------------------------
     2) Obtener perfil desde Supabase
  ---------------------------------------------------- */
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr || !profile) {
    console.error("Error cargando perfil:", profileErr);
    alert("No se pudo cargar tu perfil.");
    return;
  }

  /* ----------------------------------------------------
     Helpers para asignar valores
  ---------------------------------------------------- */
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };

  const setSwitch = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  };

  /* ----------------------------------------------------
     3) Rellenar campos del formulario
  ---------------------------------------------------- */

  // Datos principales
  set("input_fullname", profile.full_name);
  set("input_birthdate", profile.birthdate);
  set("input_gender", profile.gender);
  set("input_phone", profile.phone);
  set("input_country", profile.country);

  // Preferencias
  set("input_language", profile.language);
  set("input_timezone", profile.timezone);
  set("input_focus", profile.preferred_focus_time);

  // Notificaciones JSON
  const notif = profile.notifications || {};
  setSwitch("notif_racha", notif.notifRacha);
  setSwitch("notif_privNombre", notif.privNombre);
  setSwitch("notif_tema", notif.temaVisual === "auto");

  // Objetivos JSON
  const goals = profile.goals_json || {};
  setSwitch("goal_disciplina", goals.disciplina);
  setSwitch("goal_foco", goals.foco);
  setSwitch("goal_energia", goals.energia);

  // Info fija
  document.getElementById("p_email").textContent = profile.email || user.email;
  document.getElementById("p_created").textContent =
    new Date(profile.created_at).toLocaleDateString();

  /* ----------------------------------------------------
     4) Avatar — mostrar imagen actual
  ---------------------------------------------------- */
  const avatarPreview = document.getElementById("avatarPreview");
  avatarPreview.src =
    profile.avatar_url ||
    "/assets/default-avatar.png";

  /* ----------------------------------------------------
     5) Avatar — lógica de Cropper
  ---------------------------------------------------- */
  let cropper = null;
  const avatarInput = document.getElementById("avatarInput");
  const avatarModal = document.getElementById("avatarModal");
  const avatarCropImage = document.getElementById("avatarCropImage");

  avatarInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen no puede superar los 2 MB.");
      avatarInput.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    avatarCropImage.src = url;

    avatarCropImage.onload = () => {
      avatarModal.classList.remove("hidden");

      if (cropper) cropper.destroy();

      cropper = new Cropper(avatarCropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 1,
        background: false
      });
    };
  });

  /* Cancelar recorte */
  document.getElementById("avatarCropCancel").onclick = () => {
    if (cropper) cropper.destroy();
    cropper = null;
    avatarModal.classList.add("hidden");
    avatarInput.value = "";
  };

  /* Aplicar recorte + filtros A+ */
  document.getElementById("avatarCropApply").onclick = async () => {
    if (!cropper) return;

    const croppedCanvas = cropper.getCroppedCanvas({
      width: 450,
      height: 450
    });

    // Canvas con filtro Advance+
    const filtered = document.createElement("canvas");
    filtered.width = 450;
    filtered.height = 450;
    const ctx = filtered.getContext("2d");

    ctx.filter =
      "brightness(1.04) contrast(1.06) saturate(1.07) blur(0.3px)";
    ctx.drawImage(croppedCanvas, 0, 0, 450, 450);

    filtered.toBlob(async (blob) => {
      const fileName = `${userId}_${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { upsert: true });

      if (upErr) {
        alert("Error subiendo avatar.");
        console.error(upErr);
        return;
      }

      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Guardar en profiles
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl.publicUrl })
        .eq("id", userId);

      avatarPreview.src = publicUrl.publicUrl;
      avatarModal.classList.add("hidden");

      cropper.destroy();
      cropper = null;
      avatarInput.value = "";
      loadHeader();
    }, "image/jpeg", 0.9);
  };

  /* Eliminar avatar */
  document.getElementById("avatarDelete").onclick = async () => {
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);

    avatarPreview.src = "/assets/default-avatar.png";
    loadHeader();
  };

  /* ----------------------------------------------------
     6) Guardar cambios del perfil
  ---------------------------------------------------- */
  document.getElementById("saveProfileBtn").onclick = async () => {
    const updates = {
      full_name: document.getElementById("input_fullname").value.trim(),
      birthdate: document.getElementById("input_birthdate").value || null,
      gender: document.getElementById("input_gender").value,
      phone: document.getElementById("input_phone").value.trim(),
      country: document.getElementById("input_country").value.trim(),
      language: document.getElementById("input_language").value,
      timezone: document.getElementById("input_timezone").value.trim(),
      preferred_focus_time: document.getElementById("input_focus").value,

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

      updated_at: new Date()
    };

    const { error: saveErr } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    const msg = document.getElementById("saveMessage");

    if (saveErr) {
      msg.textContent = "❌ Error al guardar";
      msg.style.color = "#ff6b6b";
      console.error(saveErr);
      return;
    }

    msg.textContent = "✔ Cambios guardados";
    msg.style.color = "#3ee98a";
    loadHeader();
  };
});

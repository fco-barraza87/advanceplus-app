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

  document.getElementById("avatarInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validar tamaño
  if (file.size > 2 * 1024 * 1024) {
    alert("La imagen no puede superar los 2 MB.");
    return;
  }

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {

    // --- 1. Tomar el lado más corto (crop cuadrado) ---
    const side = Math.min(img.width, img.height);

    const startX = (img.width - side) / 2;
    const startY = (img.height - side) / 2;

    // --- 2. Crear canvas cuadrado 400x400 ---
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    // --- 3. Dibujar imagen recortada y escalada ---
    ctx.drawImage(
      img,
      startX,
      startY,
      side,
      side,
      0,
      0,
      400,
      400
    );

    // --- 4. Convertir a blob JPG comprimido ---
    canvas.toBlob(async (blob) => {
      if (!blob) {
        alert("Error procesando la imagen.");
        return;
      }

      // Nombre único
      const fileName = `${user.id}_${Date.now()}.jpg`;

      // Subir a Supabase Storage
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
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl.publicUrl })
        .eq("id", user.id);

      // Set preview + actualizar header
      document.getElementById("avatarPreview").src = publicUrl.publicUrl;
      loadUserHeader();

    }, "image/jpeg", 0.9); // calidad 90%
  };
});



  document.getElementById("avatarDelete").addEventListener("click", async () => {
  
  await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  document.getElementById("avatarPreview").src = "/img/avatar-placeholder.png";

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

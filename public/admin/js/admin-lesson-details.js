import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("id");

const form = document.getElementById("lessonForm");
const saveBtn = document.getElementById("btnSaveLesson");
const titleEl = document.querySelector(".module-header h1");

const fields = [
  "day","title","subtitle","duration","xp_reward",
  "text_content","exercise_content","content_html",
  "audio_url","video_url","image_url",
  "meditation_url","download_url","ai_prompt","ai_meta"
];

async function init() {
  await requireAdmin();

  if (lessonId) {
    titleEl.textContent = "Editar lección";
    await loadLesson();
  } else {
    titleEl.textContent = "Nueva lección";
    setDefaults();
  }
}

init();


// ================================
// Valores por defecto (CREAR)
// ================================
function setDefaults() {
  document.getElementById("day").value = 1;
  document.getElementById("duration").value = 5;
  document.getElementById("xp_reward").value = 10;
  document.getElementById("is_checkpoint").checked = false;
}


// ================================
// Cargar lección (EDITAR)
// ================================
async function loadLesson() {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (error) {
    alert("Error cargando la lección");
    console.error(error);
    return;
  }

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && data[f] !== null) el.value = data[f];
  });

  document.getElementById("is_checkpoint").checked = !!data.is_checkpoint;
}


// ================================
// GUARDAR (CREAR / EDITAR)
// ================================
saveBtn.addEventListener("click", async () => {

  const payload = {};

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (!el) return;

    const val = el.value;
    payload[f] = val === "" ? null : val;
  });

  payload.is_checkpoint = document.getElementById("is_checkpoint").checked;

  let result;

  if (lessonId) {
    // EDITAR
    result = await supabase
      .from("lessons")
      .update(payload)
      .eq("id", lessonId);
  } else {
    // CREAR
    // ⚠️ course_id debe venir del admin (ver nota abajo)
    payload.course_id = await getDefaultCourseId();

    result = await supabase
      .from("lessons")
      .insert(payload);
  }

  if (result.error) {
    console.error(result.error);
    alert("Error guardando la lección");
    return;
  }

  alert("Lección guardada correctamente");
  window.location.href = "/admin/lessons.html";
});


// ================================
// Obtener curso por defecto
// ================================
async function getDefaultCourseId() {
  const { data, error } = await supabase
    .from("courses")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    alert("No hay cursos disponibles. Crea un curso primero.");
    throw error;
  }

  return data.id;
}

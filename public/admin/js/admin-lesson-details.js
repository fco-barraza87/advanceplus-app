import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("id");

const fields = [
  "day","title","subtitle","duration","xp_reward","text_content",
  "exercise_content","content_html","audio_url","video_url",
  "image_url","meditation_url","download_url","ai_prompt","ai_meta"
];

async function init() {
  await requireAdmin();
  if (!lessonId) return alert("Lección no encontrada");
  await loadLesson();
}

init();

// ================================
// Cargar lección
// ================================
async function loadLesson() {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (error) {
    console.error(error);
    alert("Error cargando lección");
    return;
  }

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && data[f] !== null) el.value = data[f];
  });

  document.getElementById("is_checkpoint").checked = !!data.is_checkpoint;
}

// ================================
// Guardar
// ================================
document.getElementById("btnSaveLesson").addEventListener("click", async () => {
  const payload = {};

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) payload[f] = el.value || null;
  });

  payload.is_checkpoint = document.getElementById("is_checkpoint").checked;

  const { error } = await supabase
    .from("lessons")
    .update(payload)
    .eq("id", lessonId);

  if (error) {
    console.error(error);
    alert("Error guardando cambios");
    return;
  }

  alert("Lección guardada correctamente");
});

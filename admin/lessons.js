// /admin/lessons.js
import { supabase } from "/js/supabase.js";
import { requireAdmin, setAdminHeader } from "/admin/js/admin.js";

let courses = [];
let lessons = [];

document.addEventListener("DOMContentLoaded", async () => {
  await requireAdmin();
  setAdminHeader("Panel Admin · Lecciones", "Ver y editar las lecciones de cada curso.");

  setupEvents();
  await loadCoursesOptions();
});

/* -------------------------
   EVENTOS
------------------------- */
function setupEvents() {
  const select = document.getElementById("lessonsCourseSelect");
  const btnNew = document.getElementById("btnNewLesson");
  const form = document.getElementById("lessonForm");
  const btnReset = document.getElementById("btnResetLessonForm");

  select.addEventListener("change", async () => {
    const courseId = select.value;
    if (courseId) await loadLessons(courseId);
  });

  btnNew.addEventListener("click", () => {
    clearLessonForm();
    document.getElementById("lessonFormTitle").textContent = "Nueva lección";
  });

  btnReset.addEventListener("click", () => {
    clearLessonForm();
    document.getElementById("lessonFormTitle").textContent = "Nueva lección";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveLesson();
  });
}

/* -------------------------
   CARGAR CURSOS
------------------------- */
async function loadCoursesOptions() {
  const select = document.getElementById("lessonsCourseSelect");
  select.innerHTML = `<option value="">Cargando cursos...</option>`;

  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando cursos:", error);
    select.innerHTML = `<option value="">Error al cargar cursos</option>`;
    return;
  }

  courses = data || [];

  if (!courses.length) {
    select.innerHTML = `<option value="">No hay cursos</option>`;
    return;
  }

  select.innerHTML = `<option value="">Selecciona un curso...</option>`;
  courses.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    select.appendChild(opt);
  });
}

/* -------------------------
   CARGAR LECCIONES
------------------------- */
async function loadLessons(courseId) {
  const tbody = document.getElementById("lessonsTableBody");
  tbody.innerHTML = `<tr><td colspan="4">Cargando...</td></tr>`;

  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("day", { ascending: true });

  if (error) {
    console.error("Error cargando lecciones:", error);
    tbody.innerHTML = `<tr><td colspan="4">Error al cargar lecciones</td></tr>`;
    return;
  }

  lessons = data || [];
  renderLessonsTable();
}

function renderLessonsTable() {
  const tbody = document.getElementById("lessonsTableBody");

  if (!lessons.length) {
    tbody.innerHTML = `<tr><td colspan="4">No hay lecciones en este curso.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  lessons.forEach((lesson) => {
    const tr = document.createElement("tr");
    tr.classList.add("admin-row-click");

        tr.innerHTML = `
            <td style="font-size:0.75rem; color:#9bb;">${lesson.id}</td>
            <td>${lesson.day}</td>
            <td>${lesson.title}</td>
            <td>${lesson.xp_reward ?? 0}</td>
            <td>${lesson.duration ?? 0} min</td>
        `;


    tr.addEventListener("click", () => fillLessonForm(lesson));
    tbody.appendChild(tr);
  });
}

/* -------------------------
   FORMULARIO
------------------------- */
function fillLessonForm(lesson) {
  document.getElementById("lessonFormTitle").textContent = "Editar lección";

  document.getElementById("lessonId").value = lesson.id;
  document.getElementById("lessonCourseId").value = lesson.course_id;

  document.getElementById("lessonDay").value = lesson.day;
  document.getElementById("lessonTitle").value = lesson.title;
  document.getElementById("lessonSubtitle").value = lesson.subtitle ?? "";
  document.getElementById("lessonDuration").value = lesson.duration ?? 0;
  document.getElementById("lessonXpReward").value = lesson.xp_reward ?? 0;
  document.getElementById("lessonTags").value = (lesson.tags || []).join(", ");

  document.getElementById("lessonContentHtml").value = lesson.content_html ?? "";
  document.getElementById("lessonTextContent").value = lesson.text_content ?? "";
  document.getElementById("lessonExerciseContent").value = lesson.exercise_content ?? "";

  document.getElementById("lessonImageUrl").value = lesson.image_url ?? "";
  document.getElementById("lessonVideoUrl").value = lesson.video_url ?? "";
  document.getElementById("lessonAudioUrl").value = lesson.audio_url ?? "";
  document.getElementById("lessonMeditationUrl").value = lesson.meditation_url ?? "";
}

function clearLessonForm() {
  const courseId = document.getElementById("lessonsCourseSelect").value;

  document.getElementById("lessonFormTitle").textContent = "Nueva lección";
  document.getElementById("lessonId").value = "";
  document.getElementById("lessonCourseId").value = courseId;

  document.getElementById("lessonDay").value = lessons.length + 1;
  document.getElementById("lessonTitle").value = "";
  document.getElementById("lessonSubtitle").value = "";
  document.getElementById("lessonDuration").value = 0;
  document.getElementById("lessonXpReward").value = 25;
  document.getElementById("lessonTags").value = "";

  document.getElementById("lessonContentHtml").value = "";
  document.getElementById("lessonTextContent").value = "";
  document.getElementById("lessonExerciseContent").value = "";

  document.getElementById("lessonImageUrl").value = "";
  document.getElementById("lessonVideoUrl").value = "";
  document.getElementById("lessonAudioUrl").value = "";
  document.getElementById("lessonMeditationUrl").value = "";
}

/* -------------------------
   GUARDAR LECCIÓN (UPDATE/INSERT)
------------------------- */
async function saveLesson() {
  const id = document.getElementById("lessonId").value || null;
  let courseId = document.getElementById("lessonCourseId").value;

  if (!courseId) {
    alert("Debes seleccionar un curso.");
    return;
  }

  const tagsRaw = document.getElementById("lessonTags")
    .value.split(",")
    .map(t => t.trim())
    .filter(Boolean);

  const payload = {
    course_id: courseId,
    day: parseInt(document.getElementById("lessonDay").value, 10),
    title: document.getElementById("lessonTitle").value.trim(),
    subtitle: document.getElementById("lessonSubtitle").value.trim() || null,
    duration: parseInt(document.getElementById("lessonDuration").value, 10) || 0,
    xp_reward: parseInt(document.getElementById("lessonXpReward").value, 10) || 0,
    tags: tagsRaw.length ? tagsRaw : null,

    content_html: document.getElementById("lessonContentHtml").value || null,
    text_content: document.getElementById("lessonTextContent").value || null,
    exercise_content: document.getElementById("lessonExerciseContent").value || null,

    image_url: document.getElementById("lessonImageUrl").value.trim() || null,
    video_url: document.getElementById("lessonVideoUrl").value.trim() || null,
    audio_url: document.getElementById("lessonAudioUrl").value.trim() || null,
    meditation_url: document.getElementById("lessonMeditationUrl").value.trim() || null
  };

  let error;

  if (id) {
    const { error: err } = await supabase
      .from("lessons")
      .update(payload)
      .eq("id", id);
    error = err;
  } else {
    const { error: err } = await supabase
      .from("lessons")
      .insert([payload]);
    error = err;
  }

  if (error) {
    console.error("Error guardando lección:", error);
    alert("Error al guardar la lección.");
    return;
  }

  alert("Lección guardada correctamente.");
  await loadLessons(courseId);
  clearLessonForm();
}

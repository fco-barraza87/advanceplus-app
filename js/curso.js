// /js/curso.js
import { supabase } from "/js/supabase.js";
import { requireAuth } from "/js/auth.js";


(async () => {
  const params = new URLSearchParams(window.location.search);
  const identifier = params.get("c");   // puede ser slug o id
  const day = Number(params.get("day")) || 1;

  if (!identifier) {
    alert("Curso no especificado.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  const course = await loadCourse(identifier);  
  if (!course) return;

  await renderCourseHeader(course);
  await loadUserProgress(course.id, day);
})();

// =======================
// Utils
// =======================
const qs = (sel) => document.querySelector(sel);

function getQueryParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

// =======================
// Datos cargados en runtime
// =======================
let user = null;
let course = null;
let lessons = [];
let userCourse = null;
let currentDay = 1;

// =======================
// Inicialización
// =======================
(async () => {
  // 1) Proteger vista
  user = await requireAuth();
  if (!user) return;

  // 2) Obtener slug de la URL
  const slug = getQueryParam("c");
  if (!slug) {
    alert("Curso no encontrado.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  // 3) Cargar datos
  await loadCourse(slug);
  await loadLessons(course.id);
  await loadUserCourse(user.id, course.id);

  // 4) Render UI
  renderHeader();
  renderTimeline();
  renderLesson(currentDay);

  // 5) Eventos
  setupEvents();
})();


// =======================
// Cargar curso
// =======================
async function loadCourse(identifier) {
  let query = supabase.from("courses").select("*");

  // Detectar si es UUID (ID) o SLUG
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);

  if (isUUID) {
    query = query.eq("id", identifier);
  } else {
    query = query.eq("slug", identifier);
  }

  const { data: course, error } = await query.single();

  if (error || !course) {
    console.error("Error cargando curso:", error);
    alert("Error cargando curso.");
    window.location.href = "/dashboard/index.html";
    return null;
  }

  return course;
}



// =======================
// Cargar lecciones
// =======================
async function loadLessons(courseId) {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("day", { ascending: true });

  if (error) {
    console.error(error);
    alert("Error cargando lecciones.");
    return;
  }

  lessons = data;
}


// =======================
// Cargar progreso del usuario
// =======================
async function loadUserCourse(userId, courseId) {
  const { data, error } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .single();

  if (error) {
    // Usuario aún no está inscrito → lo inscribimos
    await supabase.from("user_courses").insert({
      user_id: userId,
      course_id: courseId,
      status: "active",
      progress_pct: 0
    });

    return await loadUserCourse(userId, courseId);
  }

  userCourse = data;
  currentDay = Math.max(1, Math.floor(lessons.length * (data.progress_pct / 100)) || 1);
}


// =======================
// Render Header
// =======================
function renderHeader() {
  qs("#courseTitle").textContent = course.title;
  qs("#courseSubtitle").textContent = course.subtitle ?? "";
  qs("#courseCategory").textContent = course.category ?? "";
  qs("#courseXpReward").textContent = `+${course.xp_reward || 0} XP`;
}


// =======================
// Render Timeline
// =======================
function renderTimeline() {
  const timeline = qs("#timeline");
  timeline.innerHTML = "";

  const total = lessons.length;
  const completed = Math.floor((userCourse.progress_pct / 100) * total);

  qs("#progressText").textContent = `Progreso: ${userCourse.progress_pct}%`;

  lessons.forEach((l) => {
    const div = document.createElement("div");
    div.className = "day-chip";

    if (l.day === currentDay) div.classList.add("active");
    if (l.day <= completed) div.classList.add("completed");

    // Modo linear: solo días <= completed+1 están desbloqueados
    if (course.progression_type === "linear") {
      if (l.day > completed + 1) {
        div.classList.add("locked");
      }
    }

    div.textContent = l.day;

    div.onclick = () => {
      if (div.classList.contains("locked")) return;
      currentDay = l.day;
      renderTimeline();
      renderLesson(l.day);
    };

    timeline.appendChild(div);
  });
}


// =======================
// Render Lesson
// =======================
function renderLesson(day) {
  const lesson = lessons.find((l) => l.day === day);
  if (!lesson) return;

  qs("#lessonDayLabel").textContent = `Día ${lesson.day}`;
  qs("#lessonTitle").textContent = lesson.title;
  qs("#lessonSubtitle").textContent = lesson.subtitle ?? "";
  qs("#lessonXp").textContent = `+${lesson.xp_reward || 0} XP`;

  // Texto / HTML
  qs("#lessonBody").innerHTML = lesson.text_content ?? lesson.content_html ?? "";

  // Imagen
  if (lesson.image_url) {
    qs("#lessonImageWrapper").style.display = "block";
    qs("#lessonImage").src = lesson.image_url;
  } else {
    qs("#lessonImageWrapper").style.display = "none";
  }

  // Ejercicio
  if (lesson.exercise_content) {
    qs("#lessonExercise").style.display = "block";
    qs("#lessonExercise").innerHTML = lesson.exercise_content;
  } else {
    qs("#lessonExercise").style.display = "none";
  }
}


// =======================
// Completar lección
// =======================
async function completeCurrentLesson() {
  const lesson = lessons.find((l) => l.day === currentDay);

  // 1) Subir progreso
  const total = lessons.length;
  const newProgress = Math.min(100, (lesson.day / total) * 100);

  await supabase
    .from("user_courses")
    .update({
      progress_pct: newProgress,
      completed_at: newProgress === 100 ? new Date() : null,
      updated_at: new Date(),
      xp_gained: (userCourse.xp_gained || 0) + (lesson.xp_reward || 0)
    })
    .eq("id", userCourse.id);

  // 2) Dar XP real
  await supabase.rpc("add_xp", {
    user_id_input: user.id,
    xp_input: lesson.xp_reward || 0
  });

  // 3) Recargar info
  await loadUserCourse(user.id, course.id);
  renderTimeline();

  // 4) Si hay siguiente día → mostrarlo
  if (currentDay < lessons.length) {
    currentDay++;
    renderLesson(currentDay);
    renderTimeline();
  } else {
    alert("¡Curso completado! 🎉");
  }
}


// =======================
// Event Handlers
// =======================
function setupEvents() {
  qs("#btnBack").onclick = () => window.location.href = "/dashboard/index.html";

  qs("#btnCompletar").onclick = () => completeCurrentLesson();
}

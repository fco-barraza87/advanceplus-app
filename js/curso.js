import { supabase } from "/js/supabase.js";

/* ============================================
   CARGAR CURSO SOLO POR ID
============================================ */
async function loadCourse(courseId) {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error || !data) {
    console.error("Error cargando curso:", error);
    alert("Error cargando curso.");
    return null;
  }

  return data;
}

/* ============================================
   HEADER DEL CURSO
============================================ */
export async function renderCourseHeader(course) {
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseSubtitle").textContent = course.subtitle || "";
  document.getElementById("courseCategory").textContent = course.category || "";
  document.getElementById("courseXpHeader").textContent =
    `${course.xp_reward || 0} XP`;
}

document.getElementById("btnBack").onclick = () => {
  history.back();
};

/* ============================================
   CARGAR LECCIONES POR COURSE_ID
============================================ */
async function loadLessons(courseId) {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("day", { ascending: true });

  if (error || !data) {
    console.error("Error cargando lecciones:", error);
    alert("Error cargando lecciones.");
    return [];
  }

  return data;
}

/* ============================================
   PROGRESO DEL USUARIO
============================================ */
async function loadUserProgress(courseId, day) {
  const { data: userCourses } = await supabase
    .from("user_courses")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();

  let progress = userCourses?.progress_pct || 0;
  document.getElementById("courseProgressText").textContent =
    `Progreso: ${progress}%`;
}

/* ============================================
   PINTAR TIMELINE
============================================ */
function renderTimeline(days, activeDay) {
  const timeline = document.getElementById("timelineDays");
  timeline.innerHTML = "";

  for (let d = 1; d <= days; d++) {
    const chip = document.createElement("div");
    chip.className = "day-chip";

    if (d === activeDay) chip.classList.add("active");
    if (d < activeDay) chip.classList.add("completed");

    chip.textContent = d;
    chip.onclick = () => {
      const params = new URLSearchParams(window.location.search);
      params.set("day", d);
      window.location.search = params.toString();
    };

    timeline.appendChild(chip);
  }
}

/* ============================================
   CARGAR LECCIÓN DEL DÍA
============================================ */
function renderLesson(lesson) {
  document.getElementById("lessonTitle").textContent = lesson.title;
  document.getElementById("lessonSubtitle").textContent =
    lesson.subtitle || "";

  const bodyHtml =
    lesson.content_html ||
    lesson.text_content ||
  "<p>Sin contenido.</p>";

document.getElementById("lessonBody").innerHTML = bodyHtml;


  document.getElementById("lessonXp").textContent =
    `${lesson.xp_reward || 0} XP`;

  // Imagen
  if (lesson.image_url) {
    document.getElementById("lessonImageWrapper").style.display = "block";
    document.getElementById("lessonImage").src = lesson.image_url;
  } else {
    document.getElementById("lessonImageWrapper").style.display = "none";
  }

  // Audio
  if (lesson.audio_url) {
    document.getElementById("lessonAudioWrapper").style.display = "block";
    document.getElementById("lessonAudio").src = lesson.audio_url;
  } else {
    document.getElementById("lessonAudioWrapper").style.display = "none";
  }

  // XP
  document.getElementById("lessonXp").textContent =
    `${lesson.xp_reward || 0} XP`;
}

/* ============================================
   COMPLETAR LECCIÓN
============================================ */
async function completeLesson(courseId, day, xp) {

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    alert("Sesión expirada. Inicia sesión nuevamente.");
    window.location.href = "/index.html";
    return;
  }

  const { data, error } = await supabase.rpc("finish_lesson", {
    p_user_id: userId,
    p_course_id: courseId,
    p_day: day,
    p_xp: xp
  });

  if (error) {
    console.error("Error completando lección:", error);
    alert("No se pudo marcar como completado.");
    return;
  }

  alert("Lección completada 🎉");
  window.location.reload();
}


/* ============================================
   MAIN
============================================ */
(async () => {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("c");
  const day = Number(params.get("day")) || 1;

  if (!courseId) {
    alert("Falta el ID del curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  // 1. CURSO
  const course = await loadCourse(courseId);
  if (!course) return;

  renderCourseHeader(course);

  // 2. LECCIONES
  const lessons = await loadLessons(course.id);
  const lesson = lessons.find(l => l.day === day);

  if (!lesson) {
    alert("Lección no encontrada.");
    return;
  }

  // 3. RENDER
  renderTimeline(lessons.length, day);
  renderLesson(lesson);
  loadUserProgress(course.id, day);

  // 4. BOTÓN COMPLETAR
  document.getElementById("btnCompletar").onclick = () => {
  console.log("CLICK COMPLETAR → OK");
  completeLesson(course.id, day, lesson.xp_reward);
};

})();

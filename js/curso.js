import { supabase } from "/js/supabase.js";

/* ============================================================================
   1) CARGAR CURSO POR ID
=========================================================================== */
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

/* ============================================================================
   2) RENDERIZAR HEADER DEL CURSO
=========================================================================== */
function renderCourseHeader(course) {
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseSubtitle").textContent =
    course.subtitle || "";
  document.getElementById("courseCategory").textContent =
    course.category || "";

  document.getElementById("courseXpReward").textContent =
    `+${course.xp_reward || 0} XP`;
}

/* ============================================================================
   3) CARGAR LECCIONES DEL CURSO
=========================================================================== */
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

/* ============================================================================
   4) PROGRESO GENERAL DEL CURSO (user_courses)
=========================================================================== */
async function loadUserProgress(courseId) {
  const { data } = await supabase
    .from("user_courses")
    .select("progress_pct")
    .eq("course_id", courseId)
    .maybeSingle();

  const pct = data?.progress_pct || 0;

  document.getElementById("courseProgressText").textContent =
    `Progreso: ${pct}%`;
}

/* ============================================================================
   5) RENDER TIMELINE
=========================================================================== */
function renderTimeline(days, activeDay) {
  const timeline = document.getElementById("timelineDays");
  timeline.innerHTML = "";

  for (let d = 1; d <= days; d++) {
    const chip = document.createElement("div");
    chip.className = "day-chip";
    chip.textContent = d;

    if (d === activeDay) chip.classList.add("active");
    if (d < activeDay) chip.classList.add("completed");

    chip.onclick = () => {
      const params = new URLSearchParams(window.location.search);
      params.set("day", d);
      window.location.search = params.toString();
    };

    timeline.appendChild(chip);
  }
}

/* ============================================================================
   6) RENDER LECCIÓN
=========================================================================== */
function renderLesson(lesson) {
  document.getElementById("lessonDayLabel").textContent =
    `Día ${lesson.day}`;
  document.getElementById("lessonTitle").textContent = lesson.title;
  document.getElementById("lessonSubtitle").textContent =
    lesson.subtitle || "";

  /* --- CONTENIDO HTML --- */
  const htmlBody = lesson.content_html?.trim() || "";
  const textBody = lesson.text_content?.trim() || "";

  document.getElementById("lessonBody").innerHTML =
    htmlBody || `<p>${textBody || ""}</p>`;

  /* --- IMAGEN --- */
  if (lesson.image_url) {
    document.getElementById("lessonImageWrapper").style.display = "block";
    document.getElementById("lessonImage").src = lesson.image_url;
  } else {
    document.getElementById("lessonImageWrapper").style.display = "none";
  }

  /* --- AUDIO (opcional) --- */
  if (lesson.audio_url) {
    if (!document.getElementById("lessonAudioWrapper")) {
      const audio = document.createElement("div");
      audio.id = "lessonAudioWrapper";
      audio.className = "lesson-audio-wrapper";
      audio.innerHTML = `
        <audio id="lessonAudio" controls style="width:100%;">
          <source src="${lesson.audio_url}" type="audio/mpeg">
        </audio>
      `;
      document
        .getElementById("lessonContainer")
        .insertBefore(audio, document.getElementById("lessonBody"));
    } else {
      document.getElementById("lessonAudio").src = lesson.audio_url;
      document.getElementById("lessonAudioWrapper").style.display = "block";
    }
  }

  /* --- EJERCICIO --- */
  if (lesson.exercise_content?.trim()) {
    document.getElementById("lessonExercise").style.display = "block";
    document.getElementById("lessonExercise").innerHTML =
      lesson.exercise_content;
  } else {
    document.getElementById("lessonExercise").style.display = "none";
  }

  /* --- XP --- */
  document.getElementById("lessonXp").textContent =
    `+${lesson.xp_reward || 0} XP`;
}

/* ============================================================================
   7) COMPLETAR LECCIÓN (RPC)
=========================================================================== */
async function completeLesson(courseId, day, xp) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    alert("Debes iniciar sesión.");
    window.location.href = "/index.html";
    return;
  }

  const { error } = await supabase.rpc("finish_lesson", {
    p_course_id: courseId,
    p_user_id: user.id,
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

/* ============================================================================
   8) MAIN
=========================================================================== */
(async () => {
  const params = new URLSearchParams(window.location.search);

  const courseId = params.get("c");
  const day = Number(params.get("day")) || 1;

  if (!courseId) {
    alert("Falta el ID del curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  // BOTÓN VOLVER
  document.getElementById("btnBack").onclick = () => {
    window.location.href = "/dashboard/index.html";
  };

  // 1. Cargar curso
  const course = await loadCourse(courseId);
  if (!course) return;

  renderCourseHeader(course);

  // 2. Cargar lecciones
  const lessons = await loadLessons(course.id);
  const lesson = lessons.find(l => l.day === day);

  if (!lesson) {
    alert("Lección no encontrada.");
    return;
  }

  // 3. Render
  renderTimeline(lessons.length, day);
  renderLesson(lesson);
  loadUserProgress(course.id);

  // 4. Botón completar
  document.getElementById("btnCompletar").onclick = () =>
    completeLesson(course.id, day, lesson.xp_reward);
})();

// /curso/curso.js
import { supabase } from "/js/supabase.js";

/* ============================================================================
   HELPERS DE DATA
=========================================================================== */

// 1) Cargar curso por ID
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

// 2) Cargar lecciones del curso
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

// 3) Cargar user_courses (progreso del curso)
async function loadUserCourse(userId, courseId) {
  const { data } = await supabase
    .from("user_courses")
    .select("progress_pct, xp_gained")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  return data || null;
}

// 4) Cargar progreso individual por día
async function loadProgress(userId, courseId) {
  const { data } = await supabase
    .from("progress")
    .select("day, completed, xp")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  return data || [];
}

/* ============================================================================
   COMPLETAR LECCIÓN — **NUEVA VERSIÓN CON RPC finish_lesson**
=========================================================================== */

async function completeLesson(courseId, userId, day, xp_reward, maxDay) {
  // --- 1) Ejecutar RPC finish_lesson ---
  const { data, error } = await supabase.rpc("finish_lesson", {
    p_course_id: courseId,
    p_user_id: userId,
    p_day: day,
    p_xp: xp_reward
  });

  if (error) {
    console.error("Error finish_lesson:", error);
    alert("No se pudo marcar esta lección como completada.");
    return;
  }

  console.log("finish_lesson OK:", data);

  // --- 2) Avanzar al siguiente día ---
  const nextDay = day + 1;

  if (nextDay <= maxDay) {
    const params = new URLSearchParams(window.location.search);
    params.set("day", nextDay);
    window.location.search = params.toString();
  } else {
      // Último día del curso → mostrar popup y volver al dashboard
      if (nextDay > maxDay) {
        if (confirm("🎉 ¡Has completado este curso! ¿Volver al dashboard?")) {
          window.location.href = "/dashboard/index.html";
        }
        return;
      }
  }
}

/* ============================================================================
   RENDER UI
=========================================================================== */

function renderCourseHeader(course, userCourse, progressRows) {
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseSubtitle").textContent =
    course.subtitle || "";
  document.getElementById("courseCategory").textContent =
    course.category || "";

  const xpFromUserCourse = userCourse?.xp_gained ?? 0;
  const xpFromProgress = progressRows.reduce(
    (sum, row) => sum + (row.xp || 0),
    0
  );

  const totalXp = xpFromUserCourse || xpFromProgress || 0;
  document.getElementById("courseXpReward").textContent = `+${totalXp} XP`;
}

function renderCourseProgress(userCourse, lessons, progressRows) {
  let pct = userCourse?.progress_pct;

  if (pct == null) {
    const completedCount = progressRows.filter(r => r.completed).length;
    pct = lessons.length
      ? Math.round((completedCount / lessons.length) * 100)
      : 0;
  }

  document.getElementById("courseProgressText").textContent =
    `Progreso: ${pct}%`;
}

function renderTimeline(lessons, activeDay, progressRows) {
  const timeline = document.getElementById("timelineDays");
  timeline.innerHTML = "";

  const maxDay = lessons.reduce((max, l) => Math.max(max, l.day), 0);
  const completedDays = new Set(
    progressRows.filter(r => r.completed).map(r => r.day)
  );

  for (let d = 1; d <= maxDay; d++) {
    const chip = document.createElement("div");
    chip.className = "day-chip";
    chip.textContent = d;

    if (completedDays.has(d)) chip.classList.add("completed");
    if (d === activeDay) chip.classList.add("active");

    chip.onclick = () => {
      const params = new URLSearchParams(window.location.search);
      params.set("day", d);
      window.location.search = params.toString();
    };

    timeline.appendChild(chip);
  }
}

function renderLesson(lesson) {
  document.getElementById("lessonDayLabel").textContent = `DÍA ${lesson.day}`;
  document.getElementById("lessonTitle").textContent = lesson.title;
  document.getElementById("lessonSubtitle").textContent =
    lesson.subtitle || "";

  const htmlBody = (lesson.content_html || "").trim();
  const textBody = (lesson.text_content || "").trim();

  document.getElementById("lessonBody").innerHTML =
    htmlBody || (textBody ? `<p>${textBody}</p>` : "<p>Sin contenido.</p>");

  if (lesson.image_url) {
    document.getElementById("lessonImageWrapper").style.display = "block";
    document.getElementById("lessonImage").src = lesson.image_url;
  } else {
    document.getElementById("lessonImageWrapper").style.display = "none";
  }

  if ((lesson.exercise_content || "").trim()) {
    document.getElementById("lessonExercise").style.display = "block";
    document.getElementById("lessonExercise").innerHTML =
      lesson.exercise_content;
  } else {
    document.getElementById("lessonExercise").style.display = "none";
  }

  document.getElementById("lessonXp").textContent =
    `+${lesson.xp_reward || 0} XP`;
}

/* ============================================================================
   MAIN
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("Debes iniciar sesión.");
    window.location.href = "/index.html";
    return;
  }

  document.getElementById("btnBack").onclick = () => {
    window.location.href = "/dashboard/index.html";
  };

  const [course, lessons, userCourse, progressRows] = await Promise.all([
    loadCourse(courseId),
    loadLessons(courseId),
    loadUserCourse(user.id, courseId),
    loadProgress(user.id, courseId)
  ]);

  if (!course || !lessons.length) {
    alert("Curso o lecciones no encontrados.");
    return;
  }

  const maxDay = lessons.reduce((max, l) => Math.max(max, l.day), 0);
  const currentLesson = lessons.find(l => l.day === day) || lessons[0];

  renderCourseHeader(course, userCourse, progressRows);
  renderCourseProgress(userCourse, lessons, progressRows);
  renderTimeline(lessons, currentLesson.day, progressRows);
  renderLesson(currentLesson);

  document.getElementById("btnCompletar").onclick = () =>
    completeLesson(
      course.id,
      user.id,
      currentLesson.day,
      currentLesson.xp_reward,
      maxDay
    );
})();

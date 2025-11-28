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

// 3) Cargar registro user_courses (xp + progreso %)
async function loadUserCourse(userId, courseId) {
  const { data, error } = await supabase
    .from("user_courses")
    .select("progress_pct, xp_gained")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) {
    console.error("Error cargando user_courses:", error);
  }

  return data || null;
}

// 4) Cargar progreso por día (tabla progress)
async function loadProgress(userId, courseId) {
  const { data, error } = await supabase
    .from("progress")
    .select("day, completed, xp")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (error) {
    console.error("Error cargando progress:", error);
    return [];
  }

  return data || [];
}

/* ============================================================================
   RENDER UI
=========================================================================== */

// Header del curso
function renderCourseHeader(course, userCourse, progressRows) {
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseSubtitle").textContent =
    course.subtitle || "";
  document.getElementById("courseCategory").textContent =
    course.category || "";

  // XP TOTAL REAL del sistema
  document.getElementById("courseXpReward").textContent =
  `+${window.__userXpTotal || 0} XP`;

}

// Progreso general (texto "Progreso: X%")
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
  document.getElementById("progressBarFill").style.width = `${pct}%`;

}

// Timeline de días
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

    if (completedDays.has(d)) {
      chip.classList.add("completed");
    }
    if (d === activeDay) {
      chip.classList.add("active");
    }

    chip.onclick = () => {
      const params = new URLSearchParams(window.location.search);
      params.set("day", d);
      window.location.search = params.toString();
    };

    timeline.appendChild(chip);
  }

  if (!completedDays.has(d) && d > activeDay) {
    chip.classList.add("locked");
  }
}

// Render de la lección actual
function renderLesson(lesson) {
  document.getElementById("lessonDayLabel").textContent = `DÍA ${lesson.day}`;
  document.getElementById("lessonTitle").textContent = lesson.title;
  document.getElementById("lessonSubtitle").textContent =
    lesson.subtitle || "";

  // Contenido principal
  const htmlBody = (lesson.content_html || "").trim();
  const textBody = (lesson.text_content || "").trim();

  document.getElementById("lessonBody").innerHTML =
    htmlBody || (textBody ? `<p>${textBody}</p>` : "<p>Sin contenido.</p>");

  // Imagen
  if (lesson.image_url) {
    document.getElementById("lessonImageWrapper").style.display = "block";
    document.getElementById("lessonImage").src = lesson.image_url;
  } else {
    document.getElementById("lessonImageWrapper").style.display = "none";
  }

  // Ejercicio
  if ((lesson.exercise_content || "").trim()) {
    document.getElementById("lessonExercise").style.display = "block";
    document.getElementById("lessonExercise").innerHTML =
      lesson.exercise_content;
  } else {
    document.getElementById("lessonExercise").style.display = "none";
  }

  // XP de la lección
  document.getElementById("lessonXp").textContent =
    `+${lesson.xp_reward || 0} XP`;
}

/* ============================================================================
   COMPLETAR LECCIÓN (RPC) + AVANZAR AL SIGUIENTE DÍA
=========================================================================== */
async function completeLesson(courseId, userId, day, xp, maxDay) {
  const { error } = await supabase.rpc("finish_lesson", {
    p_course_id: courseId,
    p_user_id: userId,
    p_day: day,
    p_xp: xp
  });

  if (error) {
    console.error("Error completando lección:", error);
    alert("No se pudo marcar como completado.");
    return;
  }

  const nextDay = day + 1;

  if (nextDay <= maxDay) {
    // Ir al siguiente día del curso
    const params = new URLSearchParams(window.location.search);
    params.set("day", nextDay);
    window.location.search = params.toString();
  } else {
    // Último día: mantener en la página, solo refrescar progreso
    alert("🎉 ¡Has completado este curso!");
    window.location.reload();
  }
}

/* ============================================
   OBTENER XP TOTAL DESDE user_stats
============================================ */
async function loadUserXp() {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.user) return 0;

  const userId = user.user.id;

  const { data, error } = await supabase
    .from("user_stats")
    .select("xp_total")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return 0;

  return data.xp_total || 0;
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

    // cargar xp REAL del user
  const xpTotal = await loadUserXp();
  document.getElementById("courseXpReward").textContent = `+${xpTotal} XP`;

  // Usuario actual
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    alert("Debes iniciar sesión.");
    window.location.href = "/index.html";
    return;
  }

  // Botón volver
  document.getElementById("btnBack").onclick = () => {
    window.location.href = "/dashboard/index.html";
  };

  // Cargar todo en paralelo
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

  // Render UI
  renderCourseHeader(course, userCourse, progressRows);
  renderCourseProgress(userCourse, lessons, progressRows);
  renderTimeline(lessons, currentLesson.day, progressRows);
  renderLesson(currentLesson);

  // Botón "Marcar como completado"
  document.getElementById("btnCompletar").onclick = () =>
    completeLesson(
      course.id,
      user.id,
      currentLesson.day,
      currentLesson.xp_reward,
      maxDay
    );

  window.__userXpTotal = xpTotal;

})();

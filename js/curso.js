import { supabase } from "/js/supabase.js";

/* ============================================================================
   HELPERS — CARGA DE DATA
============================================================================ */

// 1) Cargar curso
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

  if (error) {
    console.error("Error cargando lecciones:", error);
    return [];
  }

  return data || [];
}

// 3) user_courses — progreso general + xp acumulado de ese curso
async function loadUserCourse(userId, courseId) {
  const { data } = await supabase
    .from("user_courses")
    .select("progress_pct, xp_gained")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  return data || null;
}

// 4) progress — estado por cada día
async function loadProgress(userId, courseId) {
  const { data } = await supabase
    .from("progress")
    .select("day, completed, xp")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  return data || [];
}

// 5) XP total global desde user_stats
async function loadUserXpTotal() {
  const { data: userResponse } = await supabase.auth.getUser();
  if (!userResponse?.user) return 0;

  const userId = userResponse.user.id;

  const { data } = await supabase
    .from("user_stats")
    .select("xp_total")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.xp_total ?? 0;
}

/* ============================================================================
   RENDER DEL HEADER
============================================================================ */
function renderCourseHeader(course, userXpTotal) {
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseSubtitle").textContent =
    course.subtitle || "";
  document.getElementById("courseCategory").textContent =
    course.category || "";

  // XP total global
  document.getElementById("courseXpReward").textContent =
    `+${userXpTotal} XP`;
}

/* ============================================================================
   RENDER DEL PROGRESO GENERAL
============================================================================ */
function renderCourseProgress(userCourse, lessons, progressRows) {
  let pct = userCourse?.progress_pct;

  if (pct == null) {
    const completeCount = progressRows.filter(p => p.completed).length;
    pct = lessons.length
      ? Math.round((completeCount / lessons.length) * 100)
      : 0;
  }

  document.getElementById("courseProgressText").textContent =
    `Progreso: ${pct}%`;
}

/* ============================================================================
   TIMELINE / DÍAS
============================================================================ */
function renderTimeline(lessons, activeDay, progressRows) {
  const timeline = document.getElementById("timelineDays");
  timeline.innerHTML = "";

  const completedDays = new Set(
    progressRows.filter(r => r.completed).map(r => r.day)
  );

  const maxDay = lessons.reduce((max, l) => Math.max(max, l.day), 0);

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

/* ============================================================================
   RENDER DE UNA LECCIÓN
============================================================================ */
function renderLesson(lesson, progressRows, maxDay) {
  document.getElementById("lessonDayLabel").textContent = `DÍA ${lesson.day}`;
  document.getElementById("lessonTitle").textContent = lesson.title;
  document.getElementById("lessonSubtitle").textContent =
    lesson.subtitle || "";

  // Body
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

  // XP
  document.getElementById("lessonXp").textContent =
    `+${lesson.xp_reward || 0} XP`;

  /* ─────────────────────────────
     BOTÓN COMPLETAR
  ───────────────────────────── */
  const progress = progressRows.find(p => p.day === lesson.day);
  const btn = document.getElementById("btnCompletar");

  if (progress?.completed) {
    btn.textContent = "Terminado";
    btn.disabled = true;
    btn.classList.add("btn-disabled");
  } else {
    btn.textContent = "Marcar como completado";
    btn.disabled = false;
    btn.classList.remove("btn-disabled");
  }

  /* ─────────────────────────────
     BOTÓN SIGUIENTE DÍA
  ───────────────────────────── */
  let nextBtn = document.getElementById("btnNextDay");
  if (!nextBtn) {
    nextBtn = document.createElement("button");
    nextBtn.id = "btnNextDay";
    nextBtn.className = "btn-course btn-next-day";
    document.querySelector(".lesson-footer").appendChild(nextBtn);
  }

  if (lesson.day >= maxDay) {
    nextBtn.style.display = "none";
  } else {
    nextBtn.style.display = "block";
    nextBtn.textContent = "Siguiente →";
    nextBtn.onclick = () => {
      const params = new URLSearchParams(window.location.search);
      params.set("day", lesson.day + 1);
      window.location.search = params.toString();
    };
  }
}

/* ============================================================================
   COMPLETAR LECCIÓN
============================================================================ */
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
    const params = new URLSearchParams(window.location.search);
    params.set("day", nextDay);
    window.location.search = params.toString();
  } else {
    alert("🎉 ¡Has completado este curso!");
    window.location.reload();
  }
}

/* ============================================================================
   MAIN
============================================================================ */
(async () => {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("c");
  const day = Number(params.get("day")) || 1;

  if (!courseId) {
    alert("Falta el ID del curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  // User
  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  // Load XP global
  const userXpTotal = await loadUserXpTotal();

  // Back button
  document.getElementById("btnBack").onclick = () =>
    window.location.href = "/dashboard/index.html";

  // Load all data
  const [course, lessons, userCourse, progressRows] = await Promise.all([
    loadCourse(courseId),
    loadLessons(courseId),
    loadUserCourse(user.id, courseId),
    loadProgress(user.id, courseId)
  ]);

  if (!course || !lessons.length) {
    alert("Curso no encontrado.");
    return;
  }

  const maxDay = Math.max(...lessons.map(l => l.day));
  const currentLesson =
    lessons.find(l => l.day === day) || lessons[0];

  // Render
  renderCourseHeader(course, userXpTotal);
  renderCourseProgress(userCourse, lessons, progressRows);
  renderTimeline(lessons, currentLesson.day, progressRows);
  renderLesson(currentLesson, progressRows, maxDay);

  // Button "Marcar como completado"
  document.getElementById("btnCompletar").onclick = () =>
    completeLesson(
      course.id,
      user.id,
      currentLesson.day,
      currentLesson.xp_reward,
      maxDay
    );
})();

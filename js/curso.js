import { supabase } from "/js/supabase.js";

/* ============================================================================
   HELPERS
============================================================================ */

async function loadCourse(courseId) {
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  return data;
}

async function loadLessons(courseId) {
  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("day", { ascending: true });
  return data || [];
}

async function loadProgress(userId, courseId) {
  const { data } = await supabase
    .from("progress")
    .select("day, completed, xp")
    .eq("user_id", userId)
    .eq("course_id", courseId);
  return data || [];
}

async function loadUserCourse(userId, courseId) {
  const { data } = await supabase
    .from("user_courses")
    .select("progress_pct, xp_gained")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return data || null;
}

async function loadUserXpTotal() {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return 0;

  const { data } = await supabase
    .from("user_stats")
    .select("xp_total")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.xp_total ?? 0;
}

/* ============================================================================
   RENDER
============================================================================ */

function renderCourseHeader(course, xpTotal) {
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseSubtitle").textContent =
    course.subtitle || "";
  document.getElementById("courseCategory").textContent =
    course.category || "";
  document.getElementById("courseXpReward").textContent =
    `+${xpTotal} XP`;
}

// Progreso general (texto + barra)
function renderCourseProgress(lessons, progressRows) {
  const totalDays = lessons.length;

  // Consideramos completado solo si completed = true Y xp > 0
  const completedDays = progressRows.filter(r =>
    r.completed === true && (r.xp ?? 0) > 0
  ).length;

  const pct = totalDays
    ? Math.round((completedDays / totalDays) * 100)
    : 0;

  // Texto
  document.getElementById("courseProgressText").textContent =
    `Progreso: ${pct}%`;

  // Barra visual
  const bar = document.getElementById("courseProgressFill");
  if (bar) {
    bar.style.width = `${pct}%`;
  }
}


function renderTimeline(lessons, activeDay, progressRows) {
  const timeline = document.getElementById("timelineDays");
  timeline.innerHTML = "";

  const completedDays = new Set(
    progressRows.filter(r => r.completed).map(r => r.day)
  );

  const maxDay = lessons.length;

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

function renderLesson(lesson, progressRows, maxDay) {
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

  /* ---- ESTADO DEL BOTÓN COMPLETAR ---- */
  const progress = progressRows.find(p => p.day === lesson.day);
  const btnComplete = document.getElementById("btnCompletar");

  if (progress?.completed) {
    btnComplete.textContent = "Terminado";
    btnComplete.disabled = true;
    btnComplete.classList.add("btn-disabled");
  } else {
    btnComplete.textContent = "Marcar como completado";
    btnComplete.disabled = false;
    btnComplete.classList.remove("btn-disabled");
  }

  /* ---- BOTÓN SIGUIENTE ---- */
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
    nextBtn.style.display = "inline-block";
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
    window.location.href = "/dashboard/index.html";
    return;
  }

  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;

  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  const userXpTotal = await loadUserXpTotal();

  const [course, lessons, progressRows, userCourse] = await Promise.all([
    loadCourse(courseId),
    loadLessons(courseId),
    loadProgress(user.id, courseId),
    loadUserCourse(user.id, courseId)
  ]);

  const maxDay = lessons.length;
  const currentLesson = lessons.find(l => l.day === day);

  /* ---- RENDER ---- */
  renderCourseHeader(course, userXpTotal);
  renderCourseProgress(lessons, progressRows);
  renderTimeline(lessons, day, progressRows);
  renderLesson(currentLesson, progressRows, maxDay);

  /* ---- BOTÓN COMPLETAR ---- */
  document.getElementById("btnCompletar").onclick = () =>
    completeLesson(
      course.id,
      user.id,
      currentLesson.day,
      currentLesson.xp_reward,
      maxDay
    );

  /* ---- VOLVER ---- */
  document.getElementById("btnBack").onclick = () =>
    window.location.href = "/dashboard/index.html";
})();

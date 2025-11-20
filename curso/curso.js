import { supabase } from "/js/supabase.js";

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

let currentUser = null;
let currentCourse = null;
let currentStats = null;
let userCourseRow = null;
let userProgress = [];
let totalDays = 0;
let selectedDay = 1;
let completedDays = 0;
let progressionType = "free";

function getQueryParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

/* ============================
   CARGA PRINCIPAL
============================ */
async function initCourse() {
  // 1) Usuario
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }
  currentUser = user;

  const courseParam = getQueryParam("c");
  const dayParam = parseInt(getQueryParam("day") || "1", 10) || 1;

  if (!courseParam) {
    alert("Curso no especificado.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  // 2) Cargar curso por id o slug
  const { data: course, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .or(`id.eq.${courseParam},slug.eq.${courseParam}`)
    .single();

  if (cErr || !course) {
    console.error("Error cargando curso:", cErr);
    alert("No se pudo cargar el curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  currentCourse = course;
  totalDays = course.duration_days || 1;
  progressionType = course.progression_type || "free";

  // 3) Validar que el curso pertenezca al usuario (user_courses)
  const { data: ucRow, error: ucErr } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("course_id", currentCourse.id)
    .eq("status", "active")
    .single();

  if (ucErr || !ucRow) {
    console.warn("Curso no asignado a este usuario:", ucErr);
    alert("No tienes acceso a este curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  userCourseRow = ucRow;

  // 4) Cargar stats globales (XP, racha, etc.)
  const { data: stats, error: sErr } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best, level")
    .eq("user_id", currentUser.id)
    .single();

  if (sErr) {
    console.error("Error cargando user_stats:", sErr);
  }
  currentStats = stats || { xp_total: 0, streak_current: 0, streak_best: 0, level: 1 };

  // 5) Cargar progreso por día
  const { data: progressRows, error: pErr } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("course_id", currentCourse.id)
    .order("day", { ascending: true });

  if (pErr) {
    console.error("Error cargando progress:", pErr);
  }

  userProgress = progressRows || [];
  completedDays = userProgress.filter((p) => p.completed).length;

  // 6) Calcular día desbloqueado segun progression_type
  let maxCompletedDay = 0;
  userProgress.forEach((p) => {
    if (p.completed && p.day > maxCompletedDay) maxCompletedDay = p.day;
  });

  let maxUnlockedDay =
    progressionType === "linear"
      ? Math.min(totalDays, (maxCompletedDay || 0) + 1)
      : totalDays;

  if (dayParam > maxUnlockedDay && progressionType === "linear") {
    selectedDay = maxUnlockedDay || 1;
  } else {
    selectedDay = dayParam;
  }

  // 7) Render UI base
  renderCourseHeader();
  renderDayTimeline(maxUnlockedDay);
  renderCourseProgressBar();

  // 8) Cargar y renderizar lección del día
  await loadAndRenderLesson(selectedDay);
  setupFeedbackUI();
}

/* ============================
   HEADER CURSO
============================ */
function renderCourseHeader() {
  if (!currentCourse) return;

  const titleEl = qs("#courseTitle");
  const subEl = qs("#courseSubtitle");
  const catEl = qs("#courseCategory");
  const xpEl = qs("#courseXpTotal");

  if (titleEl) titleEl.textContent = currentCourse.title;
  if (subEl) subEl.textContent = currentCourse.subtitle || currentCourse.description || "";
  if (catEl)
    catEl.textContent = `${currentCourse.category || ""} • ${currentCourse.duration_days || 1
    } días`;
  if (xpEl) xpEl.textContent = currentStats?.xp_total ?? 0;
}

/* ============================
   TIMELINE / DÍAS
============================ */
function renderDayTimeline(maxUnlockedDay) {
  const container = qs("#dayTimeline");
  if (!container) return;

  container.innerHTML = "";

  const completedSet = new Set(
    userProgress.filter((p) => p.completed).map((p) => p.day)
  );

  for (let d = 1; d <= totalDays; d++) {
    const chip = document.createElement("button");
    chip.className = "day-chip";

    if (d === selectedDay) chip.classList.add("active");
    if (completedSet.has(d)) chip.classList.add("completed");

    let locked = false;
    if (progressionType === "linear" && d > maxUnlockedDay) {
      chip.classList.add("locked");
      locked = true;
    }

    chip.textContent = d;

    if (!locked) {
      chip.onclick = () => {
        const url = new URL(window.location.href);
        url.searchParams.set("day", d.toString());
        window.history.pushState({}, "", url.toString());
        selectedDay = d;
        loadAndRenderLesson(d);
        renderDayTimeline(maxUnlockedDay); // refrescar highlight
      };
    }

    container.appendChild(chip);
  }
}

/* ============================
   PROGRESO GLOBAL DEL CURSO
============================ */
function renderCourseProgressBar() {
  const progressText = qs("#courseProgressText");
  if (!progressText) return;

  progressText.textContent = `Día ${selectedDay} de ${totalDays}`;
}

/* ============================
   CARGAR LECCIÓN
============================ */
async function loadAndRenderLesson(day) {
  if (!currentCourse) return;

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", currentCourse.id)
    .eq("day", day)
    .single();

  if (error || !lesson) {
    console.error("Error cargando lección:", error);
    qs("#lessonTitle").textContent = "Lección no disponible";
    qs("#lessonBody").innerHTML =
      "<p>No se encontró contenido para este día. Contáctanos si crees que es un error.</p>";
    qs("#btnCompleteDay").disabled = true;
    return;
  }

  // Actualizar encabezado de la lección
  qs("#lessonDayLabel").textContent = `Día ${day}`;
  qs("#lessonTitle").textContent = lesson.title || `Día ${day}`;
  qs("#lessonSubtitle").textContent = lesson.subtitle || "";

  // Imagen
  const imgWrapper = qs("#lessonImageWrapper");
  const imgEl = qs("#lessonImage");
  if (lesson.image_url) {
    imgEl.src = lesson.image_url;
    imgWrapper.classList.remove("hidden");
  } else {
    imgWrapper.classList.add("hidden");
  }

  // Audio (meditation_url o audio_url)
  const audioWrapper = qs("#lessonAudioWrapper");
  const audioEl = qs("#lessonAudio");
  const audioUrl = lesson.meditation_url || lesson.audio_url;
  if (audioUrl) {
    audioEl.src = audioUrl;
    audioWrapper.classList.remove("hidden");
  } else {
    audioWrapper.classList.add("hidden");
  }

  // Texto principal
  const bodyEl = qs("#lessonBody");
  const textHtml =
    lesson.text_content ||
    lesson.content_html ||
    "<p>No hay contenido de texto definido para esta lección.</p>";
  bodyEl.innerHTML = textHtml;

  // Ejercicio
  const exEl = qs("#lessonExercise");
  exEl.innerHTML =
    lesson.exercise_content ||
    "<p><strong>Ejercicio:</strong> Reflexiona unos minutos sobre lo que acabas de leer.</p>";

  // XP del día
  const xpLabel = qs("#lessonXpLabel");
  const reward = lesson.xp_reward ?? 0;
  xpLabel.textContent = `+${reward} XP`;

  // Actualizar estado del botón "completar"
  const btn = qs("#btnCompleteDay");
  const isCompleted = userProgress.some((p) => p.day === day && p.completed);

  if (isCompleted) {
    btn.textContent = "Día completado ✔";
    btn.disabled = true;
    btn.classList.add("btn-disabled");
  } else {
    btn.textContent = "Marcar día como completado";
    btn.disabled = false;
    btn.classList.remove("btn-disabled");
  }

  // Click handler
  btn.onclick = () => handleCompleteDay(day, lesson);
}

/* ============================
   COMPLETAR DÍA
============================ */
async function handleCompleteDay(day, lesson) {
  const btn = qs("#btnCompleteDay");
  if (!currentUser || !currentCourse || !currentStats || !btn) return;

  // Evitar doble click
  btn.disabled = true;

  const reward = lesson.xp_reward ?? 0;

  // 1) Buscar si ya existe fila de progress para este día
  let existing = userProgress.find((p) => p.day === day);
  let progressId = existing?.id || null;

  if (existing && existing.completed) {
    // Ya está completado → no sumamos XP de nuevo
    btn.textContent = "Día ya completado";
    return;
  }

  // 2) Insertar/actualizar progress
  if (!existing) {
    const { data: inserted, error: iErr } = await supabase
      .from("progress")
      .insert({
        user_id: currentUser.id,
        course_id: currentCourse.id,
        day,
        completed: true,
        xp: reward,
      })
      .select()
      .single();

    if (iErr) {
      console.error("Error insert progress:", iErr);
      btn.disabled = false;
      return;
    }

    userProgress.push(inserted);
    progressId = inserted.id;
  } else {
    const { data: updated, error: uErr } = await supabase
      .from("progress")
      .update({
        completed: true,
        xp: reward,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (uErr) {
      console.error("Error update progress:", uErr);
      btn.disabled = false;
      return;
    }

    // Actualizar en el array
    const idx = userProgress.findIndex((p) => p.id === existing.id);
    if (idx >= 0) userProgress[idx] = updated;
  }

  // 3) Actualizar user_stats (XP, racha, mejor racha)
  const currentXp = currentStats.xp_total ?? 0;
  const currentStreak = currentStats.streak_current ?? 0;
  const currentBest = currentStats.streak_best ?? 0;

  const newXp = currentXp + reward;
  const newStreak = currentStreak + 1; // simplificado: cada día completado suma 1
  const newBest = Math.max(currentBest, newStreak);

  const { error: sErr } = await supabase
    .from("user_stats")
    .update({
      xp_total: newXp,
      streak_current: newStreak,
      streak_best: newBest,
    })
    .eq("user_id", currentUser.id);

  if (sErr) {
    console.error("Error update user_stats:", sErr);
  } else {
    currentStats.xp_total = newXp;
    currentStats.streak_current = newStreak;
    currentStats.streak_best = newBest;
    // refrescar header XP
    const xpEl = qs("#courseXpTotal");
    if (xpEl) xpEl.textContent = newXp;
  }

  // 4) Recalcular progreso del curso
  completedDays = userProgress.filter((p) => p.completed).length;
  const pct = Math.round((completedDays / totalDays) * 100);

  const { error: ucErr } = await supabase
    .from("user_courses")
    .update({
      progress_pct: pct,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", currentUser.id)
    .eq("course_id", currentCourse.id);

  if (ucErr) {
    console.error("Error update user_courses:", ucErr);
  }

  // 5) Actualizar UI
  btn.textContent = "Día completado ✔";
  btn.disabled = true;
  btn.classList.add("btn-disabled");

  renderCourseProgressBar();

  // Animación simple
  btn.classList.add("pulse-once");
  setTimeout(() => btn.classList.remove("pulse-once"), 500);

  // 6) Avanzar automáticamente al siguiente día (si existe y si es linear)
  if (selectedDay < totalDays && progressionType === "linear") {
    const nextDay = selectedDay + 1;
    const url = new URL(window.location.href);
    url.searchParams.set("day", nextDay.toString());
    window.history.pushState({}, "", url.toString());
    selectedDay = nextDay;
    await loadAndRenderLesson(nextDay);

    // recalcular maxUnlockedDay
    let maxCompletedDay = 0;
    userProgress.forEach((p) => {
      if (p.completed && p.day > maxCompletedDay) maxCompletedDay = p.day;
    });
    const maxUnlockedDay = Math.min(totalDays, (maxCompletedDay || 0) + 1);
    renderDayTimeline(maxUnlockedDay);
  } else {
    // si free o último día, solo refrescar timeline
    let maxCompletedDay = 0;
    userProgress.forEach((p) => {
      if (p.completed && p.day > maxCompletedDay) maxCompletedDay = p.day;
    });
    const maxUnlockedDay =
      progressionType === "linear"
        ? Math.min(totalDays, (maxCompletedDay || 0) + 1)
        : totalDays;
    renderDayTimeline(maxUnlockedDay);
  }
}

/* ============================
   FEEDBACK / LIKE (solo UI)
============================ */
function setupFeedbackUI() {
  const likeBtn = qs("#likeBtn");
  const sendBtn = qs("#sendFeedbackBtn");
  const statusEl = qs("#feedbackStatus");
  const textarea = qs("#feedbackText");

  if (likeBtn) {
    likeBtn.onclick = () => {
      likeBtn.classList.toggle("liked");
      likeBtn.textContent = likeBtn.classList.contains("liked")
        ? "❤️ Me encantó"
        : "🤍 Me gustó";
    }
  }

  if (sendBtn && textarea) {
    sendBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        statusEl.textContent = "Escribe algo antes de enviar.";
        return;
      }

      // De momento SOLO UI: mostramos mensaje.
      // Más adelante podemos conectar a una tabla feedback.
      statusEl.textContent = "Gracias por tu feedback 🙌";
      textarea.value = "";

      setTimeout(() => {
        statusEl.textContent = "";
      }, 3000);
    };
  }
}

/* ============================
   INIT
============================ */
document.addEventListener("DOMContentLoaded", initCourse);

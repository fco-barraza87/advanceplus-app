// /js/lesson.js — CAPA 0 · Boot limpio y estable
import { supabase } from "/js/supabase.js";

/* ============================================================
   Helpers mínimos (sin magia)
============================================================ */
const q = (s) => document.querySelector(s);

function getQueryParam(key) {
  return new URL(window.location.href).searchParams.get(key);
}

/* ============================================================
   Auth
============================================================ */
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/* ============================================================
   Carga base: curso + lección
============================================================ */
async function loadLessonBase(userId, courseId, day) {
  const dayNum = Number(day) || 1;

  const { data: course, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (cErr || !course) {
    throw new Error("Curso no encontrado");
  }

  const { data: lesson, error: lErr } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .single();

  if (lErr || !lesson) {
    throw new Error(`No existe lección para el día ${dayNum}`);
  }

  return { course, lesson, dayNum };
}

/* ============================================================
   Render header (solo render)
============================================================ */
function renderHeader(course, lesson, dayNum) {
  const backBtn = q("#lessonBackBtn");
  const courseLabel = q("#lessonCourseLabel");
  const titleEl = q("#lessonTitle");
  const subtitleEl = q("#lessonSubtitle");
  const metaEl = q("#lessonMeta");
  const aiLine = q("#lessonAiMetaLine");

  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = `/curso/index.html?c=${course.id}`;
    };
  }

  if (courseLabel) {
    courseLabel.textContent = `${course.category || "Reto"} · ${course.title}`;
  }

  if (titleEl) {
    titleEl.textContent = lesson.title || `Día ${dayNum}`;
  }

  if (subtitleEl) {
    subtitleEl.textContent = lesson.subtitle || "";
  }

  if (metaEl) {
    metaEl.textContent = `Día ${dayNum} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 0}`;
  }

  // Línea IA solo si existe metadata
  if (aiLine && lesson.ai_meta) {
    const parts = [];
    if (lesson.ai_meta.day_theme) parts.push(`Tema: ${lesson.ai_meta.day_theme}`);
    if (lesson.ai_meta.phase) parts.push(`Fase: ${lesson.ai_meta.phase}`);
    if (lesson.ai_meta.coach_focus) parts.push(`Enfoque: ${lesson.ai_meta.coach_focus}`);
    aiLine.textContent = parts.join(" · ");
    aiLine.style.display = parts.length ? "block" : "none";
  }
}

/* ============================================================
   Render contenido principal (solo render)
============================================================ */
function renderContent(lesson) {
  const contentEl = q("#lessonContentHtml");
  const mediaEl = q("#lessonMedia");
  const exerciseTextEl = q("#lessonExerciseText");

  if (contentEl) {
    contentEl.innerHTML =
      lesson.content_html ||
      lesson.text_content ||
      "<p>Contenido disponible próximamente.</p>";
  }

  if (mediaEl) {
    mediaEl.innerHTML = "";

    if (lesson.audio_url) {
      const a = document.createElement("audio");
      a.controls = true;
      a.src = lesson.audio_url;
      mediaEl.appendChild(a);
    }

    if (lesson.video_url) {
      const v = document.createElement("video");
      v.controls = true;
      v.src = lesson.video_url;
      mediaEl.appendChild(v);
    }

    if (lesson.image_url) {
      const img = document.createElement("img");
      img.src = lesson.image_url;
      img.alt = lesson.title || "Imagen de la lección";
      mediaEl.appendChild(img);
    }
  }

  if (exerciseTextEl) {
    exerciseTextEl.innerHTML = lesson.exercise_content || "";
  }
}

/* ============================================================
   INIT — CAPA 0
============================================================ */
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  const courseId = getQueryParam("c");
  const day = getQueryParam("day") || "1";

  if (!courseId) {
    alert("Curso no especificado");
    window.location.href = "/dashboard/index.html";
    return;
  }

  try {
    const { course, lesson, dayNum } =
      await loadLessonBase(user.id, courseId, day);

    // Estado mínimo global (solo lectura)
    window.__lessonState = {
      userId: user.id,
      courseId,
      lessonId: lesson.id,
      day: dayNum
    };

    renderHeader(course, lesson, dayNum);
    renderContent(lesson);

  } catch (err) {
    console.error("[lesson][boot]", err);
    alert(err.message || "Error cargando la lección");
    window.location.href = "/dashboard/index.html";
  }
}

init();

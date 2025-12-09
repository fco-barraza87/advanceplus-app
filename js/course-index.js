// /js/course-index.js
import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

/* ===============================================
   1. Cargar usuario
=============================================== */
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/* ===============================================
   2. Cargar curso + estado de usuario
=============================================== */
async function loadCourseAndState(userId, courseId) {
  // Curso
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (courseErr || !course) throw new Error("Curso no encontrado");

  // user_courses (inscripción)
  const { data: userCourse } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  // progreso
  const { data: progress } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("day", { ascending: true });

  return { course, userCourse, progress: progress || [] };
}

/* ===============================================
   3. Calcular nextDay y % de avance
=============================================== */
function computeProgress(course, progressRows) {
  const totalDays = course.duration_days || 1;

  const completedDays = progressRows.filter((p) => p.completed);
  const completedCount = completedDays.length;

  const lastCompletedDay = completedDays.length
    ? completedDays[completedDays.length - 1].day
    : 0;

  let nextDay = lastCompletedDay + 1;
  if (nextDay > totalDays) nextDay = totalDays;

  const pct = Math.min(100, (completedCount / totalDays) * 100);

  return { totalDays, completedCount, nextDay, pct };
}

/* ===============================================
   4. Render HERO
=============================================== */
function renderHero(course, progressInfo, isEnrolled) {
  const {
    totalDays,
    completedCount,
    nextDay,
    pct
  } = progressInfo;

  const titleHero = qs("#courseTitleHero");
  const subtitleHero = qs("#courseSubtitleHero");
  const catLabel = qs("#courseCategoryLabel");
  const shortPromise = qs("#courseShortPromise");
  const metaHero = qs("#courseMetaHero");
  const imgHero = qs("#courseHeroImage");
  const progressLabel = qs("#courseProgressLabel");
  const progressDays = qs("#courseProgressDays");
  const progressFill = qs("#courseProgressFill");
  const ctaBtn = qs("#courseCtaBtn");
  const ctaNote = qs("#courseCtaNote");

  if (titleHero) titleHero.textContent = course.title || "Reto Advance+";
  if (subtitleHero) subtitleHero.textContent = course.subtitle || "";
  if (catLabel) catLabel.textContent = course.category || "Reto";

  if (shortPromise)
    shortPromise.textContent =
      course.short_promise ||
      "Sigue este reto día a día para transformar tu enfoque, disciplina y energía.";

  if (metaHero) {
    const nivel = course.level || "Todos los niveles";
    const reviewsAvg = course.reviews_average || "5.0";
    const reviewsCount = course.reviews_count || 0;

    metaHero.innerHTML = `
      <span class="course-pill">${nivel}</span>
      <span class="course-pill">${totalDays} días</span>
      <span class="course-pill">⭐ ${reviewsAvg} · ${reviewsCount} reseñas</span>
    `;
  }

  const heroImg =
    course.hero_image_url ||
    course.thumbnail_url ||
    course.cover_url ||
    "https://via.placeholder.com/800x400?text=Advance+";

  if (imgHero) {
    imgHero.style.backgroundImage = `url('${heroImg}')`;
  }

  if (progressLabel) progressLabel.textContent = `Progreso: ${pct.toFixed(0)}%`;
  if (progressDays)
    progressDays.textContent = `${completedCount} / ${totalDays} días`;

  if (progressFill) {
    setTimeout(() => {
      progressFill.style.width = `${pct}%`;
    }, 150);
  }

  if (ctaBtn) {
    if (!isEnrolled) {
      ctaBtn.textContent = "Empezar este reto";
    } else if (completedCount >= totalDays) {
      ctaBtn.textContent = "Ver lecciones";
    } else {
      ctaBtn.textContent = `Continuar en el Día ${nextDay}`;
    }

    ctaBtn.onclick = async () => {
      if (!isEnrolled) {
        // Auto-inscribir
        const { error } = await supabase.from("user_courses").insert({
          user_id: window.__A_USER_ID,
          course_id: course.id,
          status: "active"
        });
        if (error) {
          alert("No se pudo inscribir en el curso.");
          return;
        }
        // Recargar página para que se creen filas de progress (trigger)
        window.location.reload();
        return;
      }

      // Si ya terminó, ir a la lista
      if (completedCount >= totalDays) {
        window.location.href = `/curso/lesson.html?c=${course.id}&day=${totalDays}`;
        return;
      }

      // Ir a la próxima lección pendiente
      window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
    };
  }

  if (ctaNote) {
    if (!isEnrolled) {
      ctaNote.textContent = "Al empezar, se activará este reto en tu dashboard.";
    } else {
      ctaNote.textContent = "Puedes volver a cualquier día desde la lista de lecciones.";
    }
  }
}

/* ===============================================
   5. Render lista de lecciones
=============================================== */
async function renderLessonsList(course, progressRows, progressInfo) {
  const list = qs("#lessonsList");
  if (!list) return;

  // 1. Obtener títulos reales
  const lessonTitles = await loadLessonsTitles(course.id);

  list.innerHTML = "";

  const byDay = new Map();
  progressRows.forEach((p) => {
    byDay.set(p.day, p);
  });

  const totalDays = progressInfo.totalDays;
  const nextDay = progressInfo.nextDay;

  for (let day = 1; day <= totalDays; day++) {
    const prog = byDay.get(day);
    const completed = prog?.completed === true;

    const item = document.createElement("article");
    item.className = "lesson-item-card";

    const stateLabel = completed
      ? "Completado"
      : day === nextDay
      ? "Continuar"
      : day < nextDay
      ? "Disponible"
      : course.progression_type === "linear"
      ? "Bloqueado"
      : "Disponible";

    const locked =
      course.progression_type === "linear" && day > nextDay && !completed;

    const title = lessonTitles[day] || `Lección ${day}`;

    item.innerHTML = `
      <div class="lesson-item-left">
        <div class="lesson-day-pill">Día ${day}</div>
        <div class="lesson-title-main">${title}</div>
        <div class="lesson-sub-meta">${stateLabel}</div>
      </div>
      <div class="lesson-item-right">
        ${
          completed
            ? '<span class="lesson-status done">✓</span>'
            : locked
            ? '<span class="lesson-status locked">🔒</span>'
            : '<span class="lesson-status go">→</span>'
        }
      </div>
    `;

    if (!locked) {
      item.classList.add("clickable");
      item.onclick = () => {
        window.location.href = `/curso/lesson.html?c=${course.id}&day=${day}`;
      };
    } else {
      item.classList.add("lesson-locked");
    }

    list.appendChild(item);
  }
}


/* ===============================================
   Obtener títulos reales desde lessons
=============================================== */
async function loadLessonsTitles(courseId) {
  const { data, error } = await supabase
    .from("lessons")
    .select("day, title")
    .eq("course_id", courseId)
    .order("day");

  if (error) {
    console.warn("Error cargando títulos de lecciones:", error);
    return {};
  }

  const map = {};
  data.forEach((l) => {
    map[l.day] = l.title?.trim() || null;
  });
  return map;
}


/* ===============================================
   6. INIT
=============================================== */
async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  window.__A_USER_ID = user.id;

  const courseId = getQueryParam("c");
  if (!courseId) {
    alert("No se ha especificado el curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  try {
    const { course, userCourse, progress } = await loadCourseAndState(
      user.id,
      courseId
    );

    const progressInfo = computeProgress(course, progress);
    const isEnrolled = !!userCourse;

    renderHero(course, progressInfo, isEnrolled);

    if (isEnrolled) {
      await renderLessonsList(course, progress, progressInfo);
    } else {
      // Si no está inscrito todavía, mostramos la lista pero toda bloqueada
      const fakeProgress = [];
      const fakeInfo = {
        ...progressInfo,
        nextDay: 1
      };
      await renderLessonsList(course, fakeProgress, fakeInfo);
    }
  } catch (e) {
    console.error(e);
    alert("No se pudo cargar el curso.");
    window.location.href = "/dashboard/index.html";
  }
}

init();

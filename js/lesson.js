// /js/lesson.js
import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

/* ==========================================
   1. Usuario actual
========================================== */
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/* ==========================================
   2. Cargar curso + lección + progreso
========================================== */
async function loadLessonData(userId, courseId, day) {
  const dayNum = Number(day) || 1;

  // Curso
  const { data: course, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (cErr || !course) throw new Error("Curso no encontrado");

  // Lección
  const { data: lesson, error: lErr } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .single();

  if (lErr || !lesson) throw new Error("Lección no encontrada");

  // Progreso de este día
  const { data: progress, error: pErr } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  if (pErr) console.warn("Error cargando progreso", pErr);

  // Reflexión previa (si existe)
  const { data: reflection } = await supabase
    .from("lesson_reflections")
    .select("id, content")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle()
    .catch(() => ({ data: null }));

  return { course, lesson, progress, reflection };
}

/* ==========================================
   3. Guardar reflexión (upsert)
========================================== */
async function saveReflection(userId, courseId, lesson) {
  const textarea = qs("#lessonReflectionInput");
  if (!textarea) return;

  const content = textarea.value.trim();

  // Si no hay tabla, evitamos crash silenciosamente
  try {
    const { data: existing } = await supabase
      .from("lesson_reflections")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("lesson_reflections")
        .update({ content })
        .eq("id", existing.id);
    } else {
      await supabase.from("lesson_reflections").insert({
        user_id: userId,
        course_id: courseId,
        lesson_id: lesson.id,
        day: lesson.day,
        content
      });
    }
  } catch (e) {
    console.warn("No se pudo guardar reflexión (tabla opcional)", e);
  }
}

/* ==========================================
   4. Render lección
========================================== */
function renderLessonHeader(course, lesson, day) {
  const backBtn = qs("#lessonBackBtn");
  const courseLabel = qs("#lessonCourseLabel");
  const titleEl = qs("#lessonTitle");
  const subtitleEl = qs("#lessonSubtitle");
  const metaEl = qs("#lessonMeta");

  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = `/curso/index.html?c=${course.id}`;
    };
  }

  if (courseLabel)
    courseLabel.textContent = `${course.category || "Reto"} · ${course.title}`;

  if (titleEl) titleEl.textContent = lesson.title || `Día ${day}`;
  if (subtitleEl) subtitleEl.textContent = lesson.subtitle || "";

  if (metaEl) {
    metaEl.textContent = `Día ${day} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 25}`;
  }
}

function renderLessonContent(lesson) {
  const contentEl = qs("#lessonContent");
  const mediaEl = qs("#lessonMedia");
  const exerciseTextEl = qs("#lessonExerciseText");
  const reflectionInput = qs("#lessonReflectionInput");

  if (contentEl) {
    if (lesson.content_html) {
      contentEl.innerHTML = lesson.content_html;
    } else if (lesson.text_content) {
      contentEl.textContent = lesson.text_content;
    } else {
      contentEl.textContent =
        "Muy pronto verás aquí el contenido completo de esta lección.";
    }
  }

  if (mediaEl) {
    mediaEl.innerHTML = "";

    if (lesson.audio_url) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = lesson.audio_url;
      audio.className = "lesson-audio-player";
      mediaEl.appendChild(audio);
    }

    if (lesson.video_url) {
      const video = document.createElement("video");
      video.controls = true;
      video.src = lesson.video_url;
      video.className = "lesson-video-player";
      mediaEl.appendChild(video);
    }

    if (lesson.meditation_url) {
      const med = document.createElement("audio");
      med.controls = true;
      med.src = lesson.meditation_url;
      med.className = "lesson-audio-player";
      mediaEl.appendChild(med);
    }

    if (lesson.image_url) {
      const img = document.createElement("img");
      img.src = lesson.image_url;
      img.alt = lesson.title || "Imagen de la lección";
      img.className = "lesson-image";
      mediaEl.appendChild(img);
    }
  }

  if (exerciseTextEl && lesson.exercise_content) {
    exerciseTextEl.textContent = lesson.exercise_content;
  }

  // reflectionInput se rellenará desde DB en init
}

/* ==========================================
   5. Feedback (modal)
========================================== */
function setupFeedbackStars() {
  const container = qs("#feedbackStars");
  if (!container) return;

  container.innerHTML = "";

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "feedback-star";
    star.dataset.value = String(i);
    star.textContent = "★";

    star.onclick = () => {
      const value = Number(star.dataset.value);
      container.dataset.selected = String(value);
      Array.from(container.children).forEach((child) => {
        if (Number(child.dataset.value) <= value) {
          child.classList.add("selected");
        } else {
          child.classList.remove("selected");
        }
      });
    };

    container.appendChild(star);
  }
}

function openFeedbackModal() {
  const modal = qs("#feedbackModal");
  if (!modal) return;
  modal.classList.remove("hidden");
}

function closeFeedbackModal() {
  const modal = qs("#feedbackModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

/* ==========================================
   6. Guardar feedback
========================================== */
async function saveFeedback(userId, courseId, lesson) {
  const starsContainer = qs("#feedbackStars");
  const commentEl = qs("#feedbackComment");

  if (!starsContainer) return;

  const rating = Number(starsContainer.dataset.selected || 0);
  const comment = commentEl ? commentEl.value.trim() : "";

  if (!rating && !comment) {
    // Nada que guardar
    return;
  }

  await supabase.from("lesson_feedback").insert({
    user_id: userId,
    course_id: courseId,
    lesson_id: lesson.id,
    day: lesson.day,
    rating: rating || null,
    comment: comment || null
  });
}

/* ==========================================
   7. Completar lección (progress + XP)
========================================== */
async function completeLesson(userId, course, lesson) {
  // Marcar progress.completed = true y setear XP de la lección
  await supabase
    .from("progress")
    .update({
      completed: true,
      xp: lesson.xp_reward || 0
    })
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .eq("day", lesson.day);

  // Aquí asumimos que tus triggers en DB se encargan del XP total, streak, etc.
}

/* ==========================================
   8. Cálculo de nextDay para la redirección
========================================== */
async function computeNextDayForRedirect(userId, course, currentDay) {
  const { data: allProgress } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .order("day", { ascending: true });

  const totalDays = course.duration_days || 1;

  const completedDays = (allProgress || []).filter((p) => p.completed);
  const lastCompleted = completedDays.length
    ? completedDays[completedDays.length - 1].day
    : 0;

  let nextDay = lastCompleted + 1;
  if (nextDay > totalDays) nextDay = totalDays;

  // Si ya terminó todas
  const finished = completedDays.length >= totalDays;

  return { nextDay, totalDays, finished };
}

/* ==========================================
   9. INIT
========================================== */
async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  const courseId = getQueryParam("c");
  const dayParam = getQueryParam("day") || "1";
  const dayNum = Number(dayParam) || 1;

  if (!courseId) {
    alert("No se ha especificado el curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  try {
    const { course, lesson, progress, reflection } = await loadLessonData(
      user.id,
      courseId,
      dayNum
    );

    // Rellenar reflexión previa
    const reflectionInput = qs("#lessonReflectionInput");
    if (reflectionInput && reflection?.content) {
      reflectionInput.value = reflection.content;
    }

    renderLessonHeader(course, lesson, dayNum);
    renderLessonContent(lesson);
    setupFeedbackStars();

    // auto-guardado de reflexión (on blur)
    if (reflectionInput) {
      reflectionInput.addEventListener("blur", () => {
        saveReflection(user.id, courseId, lesson);
      });
    }

    // Completar lección
    const completeBtn = qs("#completeLessonBtn");
    if (completeBtn) {
      completeBtn.onclick = async () => {
        // Guardar reflexión antes
        await saveReflection(user.id, courseId, lesson);
        await completeLesson(user.id, course, lesson);
        openFeedbackModal();
      };
    }

    // Botones feedback
    const skipBtn = qs("#feedbackSkipBtn");
    const sendBtn = qs("#feedbackSendBtn");

    if (skipBtn) {
      skipBtn.onclick = async () => {
        const { nextDay, totalDays, finished } = await computeNextDayForRedirect(
          user.id,
          course,
          lesson.day
        );

        closeFeedbackModal();

        if (finished && lesson.day >= totalDays) {
          window.location.href = `/curso/index.html?c=${course.id}`;
        } else {
          window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
        }
      };
    }

    if (sendBtn) {
      sendBtn.onclick = async () => {
        await saveFeedback(user.id, courseId, lesson);

        const { nextDay, totalDays, finished } = await computeNextDayForRedirect(
          user.id,
          course,
          lesson.day
        );

        closeFeedbackModal();

        if (finished && lesson.day >= totalDays) {
          window.location.href = `/curso/index.html?c=${course.id}`;
        } else {
          window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
        }
      };
    }
  } catch (e) {
    console.error(e);
    alert("No se pudo cargar la lección.");
    window.location.href = "/dashboard/index.html";
  }
}

init();

// /js/lesson.js — CAPA 1 · Boot + Mission Checkins
import { supabase } from "/js/supabase.js";

/* ============================================================
   Helpers
============================================================ */
const q = (s) => document.querySelector(s);
const qa = (s) => Array.from(document.querySelectorAll(s));

function getQueryParam(key) {
  return new URL(window.location.href).searchParams.get(key);
}

/* ============================================================
   Auth
============================================================ */
async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/* ============================================================
   Load base data
============================================================ */
async function loadLessonBase(userId, courseId, day) {
  const dayNum = Number(day) || 1;

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .single();

  if (!course || !lesson) {
    throw new Error("Curso o lección no encontrada");
  }

  return { course, lesson, dayNum };
}

/* ============================================================
   Render header
============================================================ */
function renderHeader(course, lesson, dayNum) {
  q("#lessonBackBtn")?.addEventListener("click", () => {
    window.location.href = `/curso/index.html?c=${course.id}`;
  });

  q("#lessonCourseLabel").textContent =
    `${course.category || "Reto"} · ${course.title}`;
  q("#lessonTitle").textContent = lesson.title || `Día ${dayNum}`;
  q("#lessonSubtitle").textContent = lesson.subtitle || "";
  q("#lessonMeta").textContent =
    `Día ${dayNum} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 0}`;

  const aiLine = q("#lessonAiMetaLine");
  if (aiLine && lesson.ai_meta) {
    const p = [];
    if (lesson.ai_meta.day_theme) p.push(`Tema: ${lesson.ai_meta.day_theme}`);
    if (lesson.ai_meta.coach_focus) p.push(`Enfoque: ${lesson.ai_meta.coach_focus}`);
    aiLine.textContent = p.join(" · ");
    aiLine.style.display = p.length ? "block" : "none";
  }
}

/* ============================================================
   Render content
============================================================ */
function renderContent(lesson) {
  q("#lessonContentHtml").innerHTML =
    lesson.content_html || "<p>Contenido próximamente.</p>";

  const media = q("#lessonMedia");
  media.innerHTML = "";

  if (lesson.audio_url) {
    const a = document.createElement("audio");
    a.controls = true;
    a.src = lesson.audio_url;
    media.appendChild(a);
  }

  if (lesson.video_url) {
    const v = document.createElement("video");
    v.controls = true;
    v.src = lesson.video_url;
    media.appendChild(v);
  }

  if (lesson.image_url) {
    const img = document.createElement("img");
    img.src = lesson.image_url;
    media.appendChild(img);
  }

  q("#lessonExerciseText").innerHTML =
    lesson.exercise_content || "";
}

/* ============================================================
   Mission Checkin (Capa 1)
============================================================ */
async function initMissionCheckin({ userId, courseId, lesson }) {
  const dayNum = Number(lesson.day);
  if (dayNum <= 1) return;

  const block = q("#missionCheckinBlock");
  if (!block) return;

  // mostrar SIEMPRE (no se vuelve a ocultar)
  block.classList.remove("hidden");

  const noteEl = q("#missionCheckinNote");
  let selectedResult = null;

  // buscar lección anterior
  const { data: prevLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", dayNum - 1)
    .single();

  if (!prevLesson) return;

  // hidratar si existe
  const { data: existing } = await supabase
    .from("mission_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", prevLesson.id)
    .maybeSingle();

  if (existing) {
    selectedResult = existing.result || null;
    if (noteEl && existing.note) noteEl.value = existing.note;

    qa("#missionCheckinBlock button[data-result]").forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.result === selectedResult
      );
    });
  }

  async function save() {
    if (!selectedResult) return;

    await supabase
      .from("mission_checkins")
      .upsert({
        user_id: userId,
        course_id: courseId,
        lesson_id: prevLesson.id,
        day: dayNum - 1,
        result: selectedResult,
        note: noteEl?.value?.trim() || null
      }, {
        onConflict: "user_id,course_id,lesson_id"
      });
  }

  qa("#missionCheckinBlock button[data-result]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedResult = btn.dataset.result;
      qa("#missionCheckinBlock button[data-result]").forEach(b =>
        b.classList.toggle("active", b === btn)
      );
      save();
    });
  });

  noteEl?.addEventListener("input", () => {
    if (!selectedResult) return;
    save();
  });
}

/* ============================================================
   INIT
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
    window.location.href = "/dashboard/index.html";
    return;
  }

  try {
    const { course, lesson, dayNum } =
      await loadLessonBase(user.id, courseId, day);

    window.__lessonState = {
      userId: user.id,
      courseId,
      lessonId: lesson.id,
      day: dayNum
    };

    renderHeader(course, lesson, dayNum);
    renderContent(lesson);

    await initMissionCheckin({
      userId: user.id,
      courseId,
      lesson
    });

  } catch (e) {
    console.error("[lesson]", e);
    alert("No se pudo cargar la lección");
    window.location.href = "/dashboard/index.html";
  }
}

init();

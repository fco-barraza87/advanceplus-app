// /js/lesson.js — CAPA 5 · Coach IA observador
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
   Load base
============================================================ */
async function loadLessonBase(courseId, day) {
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
   Render header + content (sin cambios)
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
   === CAPAS 1 → 4 ===
   (idénticas a las que ya validaste)
   👉 OMITIDAS AQUÍ POR BREVEDAD
   👉 USAR EXACTAMENTE LAS MISMAS
============================================================ */
// ⛔️ NO SE MODIFICAN
// initMissionCheckin
// initLessonReflection
// initMindset
// initFeedback

/* ============================================================
   Coach IA — Observador puro (Capa 5)
============================================================ */
async function initCoachIA({ userId, courseId, lesson }) {
  const coachBlock = q("#lessonCoachBlock");
  const coachMsg = q("#coachMessage");
  if (!coachBlock || !coachMsg) return;

  // 1. Verificar acceso
  const { data: access } = await supabase
    .from("user_coach_access")
    .select("active")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!access?.active) return;

  // 2. Recolectar contexto (read-only)
  const [
    checkin,
    reflection,
    mindset,
    feedback
  ] = await Promise.all([
    supabase.from("mission_checkins").select("*")
      .eq("user_id", userId).eq("course_id", courseId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),

    supabase.from("lesson_reflections").select("*")
      .eq("user_id", userId).eq("lesson_id", lesson.id).maybeSingle(),

    supabase.from("mindset_logs").select("*")
      .eq("user_id", userId).eq("lesson_id", lesson.id).maybeSingle(),

    supabase.from("lesson_feedback").select("*")
      .eq("user_id", userId).eq("lesson_id", lesson.id).maybeSingle()
  ]);

  const context = {
    lesson: {
      id: lesson.id,
      day: lesson.day,
      title: lesson.title,
      ai_meta: lesson.ai_meta || null
    },
    checkin: checkin?.data || null,
    reflection: reflection?.data || null,
    mindset: mindset?.data || null,
    feedback: feedback?.data || null
  };

  // 3. Llamar Edge Function (si existe)
  try {
    const session = (await supabase.auth.getSession())?.data?.session;
    if (!session?.access_token) return;

    const res = await fetch(
      "https://lmlfvbzukymtkcyfromr.supabase.co/functions/v1/coach-engine",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          intent: "lesson_observer",
          course_id: courseId,
          lesson_id: lesson.id,
          context
        })
      }
    );

    if (!res.ok) return;
    const out = await res.json();

    if (out?.message) {
      coachMsg.textContent = out.message;
      coachBlock.classList.remove("hidden");
    }

  } catch {
    // Silencio total: nunca rompe la lección
  }
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
      await loadLessonBase(courseId, day);

    renderHeader(course, lesson, dayNum);
    renderContent(lesson);

    await initMissionCheckin({ userId: user.id, courseId, lesson });
    await initLessonReflection({ userId: user.id, courseId, lesson });
    await initMindset({ userId: user.id, courseId, lesson });
    await initFeedback({ userId: user.id, courseId, lesson });

    // 👉 Coach al final, observador
    await initCoachIA({ userId: user.id, courseId, lesson });

  } catch (e) {
    console.error("[lesson]", e);
    alert("No se pudo cargar la lección");
    window.location.href = "/dashboard/index.html";
  }
}

init();

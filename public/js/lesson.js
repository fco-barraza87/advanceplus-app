// /js/lesson.js
import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

/* =====================================================
   Utils
===================================================== */
function getQueryParam(key) {
  return new URL(window.location.href).searchParams.get(key);
}

/* =====================================================
   Auth
===================================================== */
async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/* =====================================================
   Load data
===================================================== */
async function loadLessonData(userId, courseId, day) {
  const dayNum = Number(day) || 1;

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) throw new Error("Curso no encontrado");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  if (!lesson) throw new Error("Lección no encontrada");

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  const { data: reflection } = await supabase
    .from("lesson_reflections")
    .select("content")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  const { data: feedback } = await supabase
    .from("lesson_feedback")
    .select("rating, comment")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  return { course, lesson, progress, reflection, feedback };
}

/* =====================================================
   Render
===================================================== */
function renderLessonHeader(course, lesson, day) {
  qs("#lessonTitle").textContent = lesson.title || `Día ${day}`;
  qs("#lessonSubtitle").textContent = lesson.subtitle || "";
  qs("#lessonMeta").textContent =
    `Día ${day} · ${lesson.duration || 5} min · XP ${lesson.xp_reward || 20}`;
}

function renderLessonContent(lesson) {
  const contentEl = qs("#lessonContent");
  const exerciseEl = qs("#lessonExerciseText");

  if (contentEl) {
    if (lesson.content_html) {
      contentEl.innerHTML = lesson.content_html;
    } else if (lesson.text_content) {
      contentEl.innerHTML = lesson.text_content;
    } else {
      contentEl.innerHTML = "<p>Contenido próximamente.</p>";
    }
  }

  if (exerciseEl && lesson.exercise_content) {
    exerciseEl.innerHTML = lesson.exercise_content;
  }
}

/* =====================================================
   Feedback stars (FIX REAL)
===================================================== */
function setupFeedbackStars() {
  const container = qs("#feedbackStars");
  if (!container) return;

  const stars = container.querySelectorAll(".feedback-star");
  container.dataset.selected ||= "0";

  stars.forEach(star => {
    star.onclick = () => {
      const val = Number(star.dataset.value);
      container.dataset.selected = String(val);
      stars.forEach(s =>
        s.classList.toggle("selected", Number(s.dataset.value) <= val)
      );
    };
  });
}

/* =====================================================
   Mindset
===================================================== */
let pendingRedirect = null;

function initMindsetUI() {
  const moodRow = qs("#mindsetMoodRow");
  if (!moodRow) return;

  moodRow.dataset.selected = "3";
  moodRow.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      moodRow.dataset.selected = btn.dataset.value;
      moodRow.querySelectorAll("button").forEach(b =>
        b.classList.toggle("active", b === btn)
      );
    };
  });
}

function openMindsetModal() {
  qs("#mindsetModal")?.classList.remove("hidden");
}

function closeMindsetModal() {
  qs("#mindsetModal")?.classList.add("hidden");
}

async function hasMindsetLogForLesson(userId, courseId, lessonId) {
  const { data } = await supabase
    .from("mindset_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  return !!data;
}

/* =====================================================
   Coach IA
===================================================== */
async function hasActiveCoach(courseId) {
  const { data } = await supabase.rpc("has_active_coach", {
    p_course: courseId
  });
  return data === true;
}

async function callCoachEngine(payload) {
  const res = await fetch(
    "https://lmlfvbzukymtkcyfromr.supabase.co/functions/v1/coach-engine",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );
  return res.ok ? res.json() : null;
}

function renderCoachCard(blocks) {
  const card = qs("#coachCard");
  const content = qs("#coachCardContent");
  if (!card || !blocks) return;

  content.innerHTML = "";
  blocks.forEach(b => {
    const div = document.createElement("div");
    div.innerHTML = `<h4>${b.title || ""}</h4><p>${b.text}</p>`;
    content.appendChild(div);
  });

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Continuar";
  btn.onclick = () => {
    card.classList.add("hidden");
    openMindsetModal();
  };

  content.appendChild(btn);
  card.classList.remove("hidden");
}

/* =====================================================
   INIT
===================================================== */
async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  const courseId = getQueryParam("c");
  const day = getQueryParam("day") || "1";

  const { course, lesson, progress, reflection, feedback } =
    await loadLessonData(user.id, courseId, day);

  renderLessonHeader(course, lesson, day);
  renderLessonContent(lesson);
  setupFeedbackStars();
  initMindsetUI();

  const completeBtn = qs("#completeLessonBtn");
  if (!completeBtn) return;

  completeBtn.onclick = async () => {
    const redirectInfo = { course, lesson };

    if (await hasActiveCoach(course.id)) {
      const coach = await callCoachEngine({
        course_id: course.id,
        lesson_id: lesson.id,
        day: lesson.day,
        action_type: "post_lesson"
      });

      if (coach?.blocks) {
        pendingRedirect = redirectInfo;
        renderCoachCard(coach.blocks);
        return;
      }
    }

    if (await hasMindsetLogForLesson(user.id, course.id, lesson.id)) {
      window.location.href = `/curso/index.html?c=${course.id}`;
    } else {
      pendingRedirect = redirectInfo;
      openMindsetModal();
    }
  };
}

init();

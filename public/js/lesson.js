// /js/lesson.js
import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

/* ==========================================
   Helpers de fecha
========================================== */
function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) throw new Error("Curso no encontrado.");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  if (!lesson) throw new Error(`No existe lección día ${dayNum}.`);

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  const { data: reflection } = await supabase
    .from("lesson_reflections")
    .select("id, content")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  const { data: feedback } = await supabase
    .from("lesson_feedback")
    .select("id, rating, comment")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  return { course, lesson, progress, reflection, feedback };
}

/* ==========================================
   Guardar reflexión
========================================== */
async function saveReflection(userId, courseId, lesson) {
  const el = qs("#lessonReflectionInput");
  if (!el) return;
  const content = el.value.trim();

  const { data: existing } = await supabase
    .from("lesson_reflections")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  if (existing?.id) {
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
}

/* ==========================================
   Render lección
========================================== */
function renderLessonHeader(course, lesson, day) {
  qs("#lessonBackBtn")?.addEventListener("click", () => {
    window.location.href = `/curso/index.html?c=${course.id}`;
  });

  if (qs("#lessonCourseLabel"))
    qs("#lessonCourseLabel").textContent =
      `${course.category || "Reto"} · ${course.title}`;

  qs("#lessonTitle").textContent = lesson.title || `Día ${day}`;
  qs("#lessonSubtitle").textContent = lesson.subtitle || "";
  qs("#lessonMeta").textContent =
    `Día ${day} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 25}`;
}

function renderLessonContent(lesson) {
  if (lesson.content_html) qs("#lessonContent").innerHTML = lesson.content_html;
  if (lesson.exercise_content)
    qs("#lessonExerciseText").innerHTML = lesson.exercise_content;
}

/* ==========================================
   Feedback
========================================== */
function setupFeedbackStars() {
  const c = qs("#feedbackStars");
  if (!c) return;
  c.innerHTML = "";
  c.dataset.selected = "0";

  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.textContent = "★";
    b.dataset.value = i;
    b.onclick = () => {
      c.dataset.selected = i;
      [...c.children].forEach(x =>
        x.classList.toggle("selected", x.dataset.value <= i)
      );
    };
    c.appendChild(b);
  }
}

async function saveFeedback(userId, courseId, lesson) {
  const rating = Number(qs("#feedbackStars")?.dataset.selected || 0);
  const comment = qs("#feedbackComment")?.value.trim() || "";
  if (!rating && !comment) return;

  const { data: existing } = await supabase
    .from("lesson_feedback")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("lesson_feedback")
      .update({ rating, comment })
      .eq("id", existing.id);
  } else {
    await supabase.from("lesson_feedback").insert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lesson.id,
      day: lesson.day,
      rating,
      comment
    });
  }
}

/* ==========================================
   Mindset
========================================== */
let pendingRedirect = null;

function openMindsetModal() {
  qs("#mindsetModal")?.classList.remove("hidden");
}
function closeMindsetModal() {
  qs("#mindsetModal")?.classList.add("hidden");
}

async function saveMindsetLog(userId, courseId, lesson) {
  await supabase.from("mindset_logs").insert({
    user_id: userId,
    course_id: courseId,
    lesson_id: lesson.id,
    day: lesson.day,
    mood: Number(qs("#mindsetMoodRow")?.dataset.selected || null)
  });
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

/* ==========================================
   Coach IA
========================================== */
async function hasActiveCoach(courseId) {
  const { data } = await supabase.rpc("has_active_coach", {
    p_user: (await supabase.auth.getUser()).data.user.id,
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
  if (!card || !content) return;
  content.innerHTML = "";
  blocks.forEach(b => {
    const p = document.createElement("p");
    p.textContent = b.text;
    content.appendChild(p);
  });
  const btn = document.createElement("button");
  btn.textContent = "Continuar";
  btn.onclick = redirectFromMindset;
  content.appendChild(btn);
  card.classList.remove("hidden");
}

function redirectFromMindset() {
  if (!pendingRedirect) return;
  const { course, lesson, redirectInfo } = pendingRedirect;
  const { nextDay } = redirectInfo;
  window.location.href =
    `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
}

/* ==========================================
   INIT
========================================== */
async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  const courseId = getQueryParam("c");
  const dayNum = Number(getQueryParam("day") || 1);

  const { course, lesson, progress, reflection, feedback } =
    await loadLessonData(user.id, courseId, dayNum);

  renderLessonHeader(course, lesson, dayNum);
  renderLessonContent(lesson);
  setupFeedbackStars();

  qs("#completeLessonBtn")?.addEventListener("click", async () => {
    await saveReflection(user.id, courseId, lesson);
    await saveFeedback(user.id, courseId, lesson);

    const redirectInfo = { nextDay: lesson.day + 1 };

    if (await hasActiveCoach(course.id)) {
      const coach = await callCoachEngine({
        course_id: course.id,
        lesson_id: lesson.id,
        day: lesson.day,
        action_type: "post_lesson"
      });
      if (coach?.blocks) {
        pendingRedirect = { course, lesson, redirectInfo };
        renderCoachCard(coach.blocks);
        return;
      }
    }

    if (await hasMindsetLogForLesson(user.id, courseId, lesson.id)) {
      redirectFromMindset();
    } else {
      pendingRedirect = { course, lesson, redirectInfo };
      openMindsetModal();
    }
  });
}

init();

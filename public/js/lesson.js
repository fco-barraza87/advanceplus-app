// ==================================================
// lesson.js · Advance+ · DEFINITIVO
// ==================================================

import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

/* ==================================================
   HELPERS
================================================== */
function getParam(k) {
  return new URL(window.location.href).searchParams.get(k);
}

/* ==================================================
   AUTH
================================================== */
async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/* ==================================================
   DATA LOAD
================================================== */
async function loadLesson(userId, courseId, day) {
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

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  return { course, lesson, progress, dayNum };
}

/* ==================================================
   RENDER
================================================== */
function renderHeader(course, lesson, day) {
  qs("#lessonCourseLabel").textContent =
    `${course.category || "Reto"} · ${course.title}`;
  qs("#lessonTitle").textContent = lesson.title || `Día ${day}`;
  qs("#lessonSubtitle").textContent = lesson.subtitle || "";
  qs("#lessonMeta").textContent =
    `Día ${day} · ${lesson.duration || 10} min`;
}

function renderContent(lesson) {
  qs("#lessonContent").innerHTML =
    lesson.content_html || lesson.text_content || "";

  if (lesson.audio_url) {
    const a = document.createElement("audio");
    a.controls = true;
    a.src = lesson.audio_url;
    qs("#lessonMedia").appendChild(a);
  }
}

/* ==================================================
   MICRO-CHEQUEO (SOLO VISUAL + SAVE)
================================================== */
async function initCheckin(userId, courseId, dayNum) {
  if (dayNum <= 1) return;

  const card = qs("#missionCheckinCard");
  if (!card) return;

  const { data: prev } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", dayNum - 1)
    .single();

  const { data: exists } = await supabase
    .from("mission_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("lesson_id", prev.id)
    .maybeSingle();

  if (exists) return;

  card.classList.remove("hidden");

  card.querySelectorAll("[data-result]").forEach(btn => {
    btn.onclick = async () => {
      await supabase.from("mission_checkins").insert({
        user_id: userId,
        course_id: courseId,
        lesson_id: prev.id,
        day: dayNum - 1,
        result: btn.dataset.result,
        note: qs("#missionCheckinNote")?.value || null
      });
      card.classList.add("hidden");
    };
  });

  qs("#missionCheckinSkip").onclick = () =>
    card.classList.add("hidden");
}

/* ==================================================
   COACH IA (SOLO 1 MOMENTO)
================================================== */
async function hasActiveCoach(courseId) {
  const user = (await supabase.auth.getUser()).data.user;
  const { data } = await supabase.rpc("has_active_coach", {
    p_user: user.id,
    p_course: courseId
  });
  return data === true;
}

async function showCoachCard(courseId, lesson, day) {
  const active = await hasActiveCoach(courseId);
  if (!active) return;

  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return;

  const res = await fetch(
    "https://lmlfvbzukymtkcyfromr.supabase.co/functions/v1/coach-engine",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        course_id: courseId,
        lesson_id: lesson.id,
        day,
        action_type: "post_lesson",
        intent: "coach_card"
      })
    }
  );

  if (!res.ok) return;

  const json = await res.json();
  if (!json?.blocks?.length) return;

  const card = qs("#coachCard");
  const content = qs("#coachCardContent");

  content.innerHTML = "";
  json.blocks.forEach(b => {
    const p = document.createElement("p");
    p.textContent = b.text;
    content.appendChild(p);
  });

  card.classList.remove("hidden");

  qs("#coachCardContinueBtn").onclick = () =>
    card.classList.add("hidden");
}

/* ==================================================
   COMPLETE LESSON
================================================== */
async function completeLesson(userId, course, lesson, dayNum) {
  await supabase.rpc("finish_lesson", {
    p_user_id: userId,
    p_course_id: course.id,
    p_day: dayNum,
    p_xp: lesson.xp_reward || 0
  });
}

/* ==================================================
   INIT
================================================== */
async function init() {
  const user = await getUser();
  if (!user) return location.href = "/auth/login.html";

  const courseId = getParam("c");
  const day = getParam("day") || "1";

  const { course, lesson, progress, dayNum } =
    await loadLesson(user.id, courseId, day);

  renderHeader(course, lesson, dayNum);
  renderContent(lesson);

  await initCheckin(user.id, courseId, dayNum);

  qs("#completeLessonBtn").onclick = async () => {
    await completeLesson(user.id, course, lesson, dayNum);
    await showCoachCard(course.id, lesson, dayNum);
    location.href =
      `/curso/lesson.html?c=${course.id}&day=${dayNum + 1}`;
  };
}

init();

// /js/lesson.js
import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

/* ============================
   HELPERS
============================ */
function getQueryParam(key) {
  return new URL(window.location.href).searchParams.get(key);
}

/* ============================
   AUTH
============================ */
async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/* ============================
   LOAD CORE DATA
============================ */
async function loadLesson(userId, courseId, day) {
  const dayNum = Number(day);

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

  return { course, lesson, progress };
}

/* ============================
   RENDER HEADER
============================ */
function renderHeader(course, lesson) {
  qs("#lessonCourseLabel").textContent =
    `${course.category || "Reto"} · ${course.title}`;
  qs("#lessonTitle").textContent = lesson.title;
  qs("#lessonSubtitle").textContent = lesson.subtitle || "";
  qs("#lessonMeta").textContent =
    `Día ${lesson.day} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 25}`;

  qs("#btnBackToCourse").onclick = () => {
    location.href = `/curso/index.html?c=${course.id}`;
  };
}

/* ============================
   CONTENT
============================ */
function renderContent(lesson) {
  qs("#lessonContentHtml").innerHTML =
    lesson.content_html || lesson.text_content || "";

  const media = qs("#lessonMedia");
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

  qs("#lessonExerciseText").innerHTML =
    lesson.exercise_content || "";
}

/* ============================
   MICRO CHECKIN
============================ */
async function initCheckin(userId, courseId, lesson) {
  if (lesson.day <= 1) return;

  const block = qs("#missionCheckinBlock");

  const { data: prevLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", lesson.day - 1)
    .single();

  const { data: existing } = await supabase
    .from("mission_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("lesson_id", prevLesson.id)
    .maybeSingle();

  if (existing) return;

  block.classList.remove("hidden");

  let selected = null;

  block.querySelectorAll("button[data-result]").forEach(btn => {
    btn.onclick = () => {
      selected = btn.dataset.result;
      block
        .querySelectorAll("button[data-result]")
        .forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });

  qs("#missionCheckinContinue").onclick = async () => {
    if (!selected) return alert("Selecciona una opción");

    await supabase.from("mission_checkins").insert({
      user_id: userId,
      course_id: courseId,
      lesson_id: prevLesson.id,
      day: lesson.day - 1,
      result: selected,
      note: qs("#missionCheckinNote").value || null
    });

    block.classList.add("hidden");
  };
}

/* ============================
   EXERCISE (AUTOSAVE)
============================ */
function initExercise(userId, courseId, lesson) {
  const input = qs("#lessonExerciseInput");

  let timeout = null;

  input.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      await supabase.from("lesson_reflections").upsert({
        user_id: userId,
        course_id: courseId,
        lesson_id: lesson.id,
        day: lesson.day,
        content: input.value
      });
    }, 800);
  });
}

/* ============================
   MINDSET
============================ */
function initMindset() {
  const row = qs("#mindsetMoodRow");
  row.dataset.value = "3";

  row.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      row.dataset.value = btn.dataset.value;
      row.querySelectorAll("button")
        .forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });
}

/* ============================
   COACH ACCESS
============================ */
async function hasCoach(courseId) {
  const user = await getUser();
  const { data } = await supabase
    .from("user_coach_access")
    .select("active")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  return data?.active === true;
}

/* ============================
   COACH CARD
============================ */
async function showCoachIfNeeded(courseId, lesson) {
  const enabled = await hasCoach(courseId);
  if (!enabled) return;

  const card = qs("#lessonCoachBlock");
  const msg = qs("#coachMessage");

  msg.textContent =
    lesson.ai_meta?.coach_focus
      ? `Hoy tu foco es: ${lesson.ai_meta.coach_focus}.`
      : "Sigue avanzando con intención.";

  card.classList.remove("hidden");
}

/* ============================
   CTA / COMPLETE
============================ */
async function initCTA(userId, course, lesson) {
  const btn = qs("#btnCompleteLesson");

  btn.onclick = async () => {
    await supabase.rpc("finish_lesson", {
      p_user_id: userId,
      p_course_id: course.id,
      p_day: lesson.day,
      p_xp: lesson.xp_reward || 0
    });

    await supabase.from("mindset_logs").insert({
      user_id: userId,
      course_id: course.id,
      lesson_id: lesson.id,
      day: lesson.day,
      mood: Number(qs("#mindsetMoodRow").dataset.value),
      enfoque: Number(qs("#mindsetFocus").value),
      energia: Number(qs("#mindsetEnergy").value),
      motivacion: Number(qs("#mindsetMotivation").value),
      claridad: Number(qs("#mindsetClarity").value),
      confianza: Number(qs("#mindsetConfidence").value)
    });

    location.href =
      `/curso/lesson.html?c=${course.id}&day=${lesson.day + 1}`;
  };

  qs("#lessonCtaBlock").classList.remove("hidden");
}

/* ============================
   FEEDBACK (COLLAPSE)
============================ */
function initFeedback() {
  qs("#toggleFeedback").onclick = () => {
    qs("#feedbackForm").classList.toggle("hidden");
  };
}

/* ============================
   INIT
============================ */
async function init() {
  const user = await getUser();
  if (!user) return location.href = "/auth/login.html";

  const courseId = getQueryParam("c");
  const day = getQueryParam("day") || "1";

  const { course, lesson } =
    await loadLesson(user.id, courseId, day);

  renderHeader(course, lesson);
  renderContent(lesson);
  initExercise(user.id, courseId, lesson);
  initMindset();
  initFeedback();
  await initCheckin(user.id, courseId, lesson);
  await showCoachIfNeeded(courseId, lesson);
  await initCTA(user.id, course, lesson);
}

init();

import { supabase } from "/js/supabase.js";

/* ======================================================
   HELPERS
====================================================== */
const qs = (s) => document.querySelector(s);

function getQueryParam(key) {
  return new URL(window.location.href).searchParams.get(key);
}

function isTrue(v) {
  return v === true || v === 1 || v === "true" || v === "t";
}

function safeJson(obj) {
  try { return JSON.stringify(obj); } catch { return null; }
}

/* ======================================================
   AUTH
====================================================== */
async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

async function loadProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("id, goals_json, coach_style")
    .eq("id", userId)
    .maybeSingle();

  return data || {};
}

/* ======================================================
   LOAD CORE DATA
====================================================== */
async function loadLessonData(userId, courseId, day) {
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

/* ======================================================
   RENDER
====================================================== */
function renderHeader(course, lesson) {
  qs("#lessonCourseLabel").textContent =
    `${course.category || "Reto"} · ${course.title}`;
  qs("#lessonTitle").textContent = lesson.title;
  qs("#lessonSubtitle").textContent = lesson.subtitle || "";
  qs("#lessonMeta").textContent =
    `Día ${lesson.day} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 25}`;

  qs("#lessonBackBtn").onclick = () =>
    location.href = `/curso/index.html?c=${course.id}`;
}

function renderContent(lesson) {
  qs("#lessonContent").innerHTML =
    lesson.content_html || lesson.text_content || "";

  qs("#lessonExerciseText").innerHTML =
    lesson.exercise_content || "";

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
}

/* ======================================================
   MICRO CHECKIN (DÍA ANTERIOR)
====================================================== */
async function initMissionCheckin(userId, course, lesson) {
  if (lesson.day <= 1) return;

  const card = qs("#missionCheckinCard");
  if (!card) return;

  const { data: prevLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", course.id)
    .eq("day", lesson.day - 1)
    .single();

  const { data: existing } = await supabase
    .from("mission_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("lesson_id", prevLesson.id)
    .maybeSingle();

  if (existing) return;

  card.classList.remove("hidden");

  const noteInput = qs("#missionCheckinNote");

  card.querySelectorAll("button[data-result]").forEach(btn => {
    btn.onclick = async () => {

      await supabase
        .from("mission_checkins")
        .upsert({
          user_id: userId,
          course_id: course.id,
          lesson_id: prevLesson.id,
          day: lesson.day - 1,
          result: btn.dataset.result,
          note: noteInput?.value || null
        }, { onConflict: "user_id,course_id,lesson_id" });

      // 👉 COACH SOLO REFLEXIÓN, NADA MÁS
      await showCoachCardIfActive({
        course,
        lesson,
        actionType: "mission_checkin",
        userInput: btn.dataset.result
      });

      card.classList.add("hidden");
    };
  });
}

/* ======================================================
   REFLECTION (AUTOSAVE)
====================================================== */
function initReflection(userId, course, lesson) {
  const input = qs("#lessonReflectionInput");
  if (!input) return;

  let timer = null;

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      supabase.from("lesson_reflections").upsert({
        user_id: userId,
        course_id: course.id,
        lesson_id: lesson.id,
        day: lesson.day,
        content: input.value
      });
    }, 800);
  });
}

/* ======================================================
   MINDSET
====================================================== */
function initMindsetUI() {
  const moodRow = qs("#mindsetMoodRow");
  if (!moodRow) return;

  moodRow.dataset.selected = "3";

  moodRow.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      moodRow.dataset.selected = btn.dataset.value;
      moodRow.querySelectorAll("button")
        .forEach(b => b.classList.toggle("active", b === btn));
    };
  });
}

async function saveMindset(userId, course, lesson) {
  await supabase.from("mindset_logs").insert({
    user_id: userId,
    course_id: course.id,
    lesson_id: lesson.id,
    day: lesson.day,
    mood: Number(qs("#mindsetMoodRow")?.dataset.selected || 3),
    enfoque: Number(qs("#mindsetFocus").value),
    energia: Number(qs("#mindsetEnergy").value),
    motivacion: Number(qs("#mindsetMotivation").value),
    claridad: Number(qs("#mindsetClarity").value),
    confianza: Number(qs("#mindsetConfidence").value),
    notes: safeJson({
      best: qs("#mindsetNoteBest")?.value || "",
      challenge: qs("#mindsetNoteChallenge")?.value || "",
      decision: qs("#mindsetNoteDecision")?.value || ""
    })
  });
}

/* ======================================================
   COACH IA
====================================================== */
async function hasActiveCoach(courseId) {
  const { data } = await supabase
    .from("user_coach_access")
    .select("active")
    .eq("course_id", courseId)
    .maybeSingle();

  return data?.active === true;
}

async function showCoachCardIfActive({ course, lesson, actionType, userInput }) {
  if (!(await hasActiveCoach(course.id))) return;

  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return;

  const res = await fetch(
    "https://lmlfvbzukymtkcyfromr.supabase.co/functions/v1/coach-engine",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "coach_card",
        action_type: actionType,
        course_id: course.id,
        lesson_id: lesson.id,
        day: lesson.day,
        user_input: userInput || null,
        ai_meta: lesson.ai_meta || null
      })
    }
  );

  const json = await res.json();
  if (!json?.blocks?.length) return;

  qs("#coachCardContent").innerHTML =
    json.blocks.map(b =>
      `<div class="coach-block">
        ${b.title ? `<h4>${b.title}</h4>` : ""}
        <p>${b.text}</p>
      </div>`
    ).join("");

  qs("#coachCard").classList.remove("hidden");
}

/* ======================================================
   COMPLETE LESSON
====================================================== */
async function completeLesson(userId, course, lesson) {
  await supabase.rpc("finish_lesson", {
    p_user_id: userId,
    p_course_id: course.id,
    p_day: lesson.day,
    p_xp: lesson.xp_reward || 0
  });
}

/* ======================================================
   INIT
====================================================== */
async function init() {
  const user = await getCurrentUser();
  if (!user) return location.href = "/auth/login.html";

  const courseId = getQueryParam("c");
  const day = Number(getQueryParam("day") || "1");

  const profile = await loadProfile(user.id);
  const { course, lesson } = await loadLessonData(user.id, courseId, day);

  renderHeader(course, lesson);
  renderContent(lesson);

  initReflection(user.id, course, lesson);
  initMindsetUI();
  await initMissionCheckin(user.id, course, lesson);

  // coach al inicio
  await showCoachCardIfActive({
    course,
    lesson,
    actionType: "pre_lesson"
  });

  // CTA
  qs("#completeLessonBtn").onclick = async () => {
    await completeLesson(user.id, course, lesson);
    qs("#mindsetInline").classList.remove("hidden");
    qs("#mindsetInline").scrollIntoView({ behavior: "smooth" });
  };

  qs("#mindsetSaveBtn").onclick = async () => {
    await saveMindset(user.id, course, lesson);

    await showCoachCardIfActive({
      course,
      lesson,
      actionType: "post_mindset",
      userInput: qs("#lessonReflectionInput")?.value || ""
    });

    location.href =
      `/curso/lesson.html?c=${course.id}&day=${lesson.day + 1}`;
  };
}

init();

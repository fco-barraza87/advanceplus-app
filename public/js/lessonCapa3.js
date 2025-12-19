// /js/lesson.js — CAPA 3 · Boot + Checkin + Ejercicio + Mindset
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
   Render header + content
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
   Mission Checkin (Capa 1)
============================================================ */
async function initMissionCheckin({ userId, courseId, lesson }) {
  const dayNum = Number(lesson.day);
  if (dayNum <= 1) return;

  const block = q("#missionCheckinBlock");
  if (!block) return;
  block.classList.remove("hidden");

  const noteEl = q("#missionCheckinNote");
  let selectedResult = null;

  const { data: prevLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", dayNum - 1)
    .single();

  if (!prevLesson) return;

  const { data: existing } = await supabase
    .from("mission_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", prevLesson.id)
    .maybeSingle();

  if (existing) {
    selectedResult = existing.result || null;
    if (existing.note) noteEl.value = existing.note;

    qa("#missionCheckinBlock button[data-result]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.result === selectedResult);
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
        note: noteEl.value.trim() || null
      }, {
        onConflict: "user_id,course_id,lesson_id"
      });
  }

  qa("#missionCheckinBlock button[data-result]").forEach(btn => {
    btn.onclick = () => {
      selectedResult = btn.dataset.result;
      qa("#missionCheckinBlock button[data-result]").forEach(b =>
        b.classList.toggle("active", b === btn)
      );
      save();
    };
  });

  noteEl.addEventListener("input", save);
}

/* ============================================================
   Ejercicio del día (Capa 2)
============================================================ */
async function initLessonReflection({ userId, courseId, lesson }) {
  const textarea = q("#lessonExerciseInput");
  if (!textarea) return;

  const { data: existing } = await supabase
    .from("lesson_reflections")
    .select("content")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  if (existing?.content) textarea.value = existing.content;

  let t = null;

  async function save() {
    await supabase
      .from("lesson_reflections")
      .upsert({
        user_id: userId,
        course_id: courseId,
        lesson_id: lesson.id,
        day: lesson.day,
        content: textarea.value.trim()
      }, {
        onConflict: "user_id,course_id,lesson_id"
      });
  }

  textarea.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(save, 700);
  });

  textarea.addEventListener("blur", save);
}

/* ============================================================
   Mindset (Capa 3)
============================================================ */
async function initMindset({ userId, courseId, lesson }) {
  const block = q("#lessonMindsetBlock");
  if (!block) return;
  block.classList.remove("hidden");

  const moodRow = q("#mindsetMoodRow");
  const sliders = {
    enfoque: q("#mindsetFocus"),
    energia: q("#mindsetEnergy"),
    motivacion: q("#mindsetMotivation"),
    claridad: q("#mindsetClarity"),
    confianza: q("#mindsetConfidence")
  };

  const notes = {
    best: q("#mindsetNoteBest"),
    challenge: q("#mindsetNoteChallenge"),
    decision: q("#mindsetNoteDecision")
  };

  const state = {
    mood: 3,
    enfoque: 3,
    energia: 3,
    motivacion: 3,
    claridad: 3,
    confianza: 3,
    best: "",
    challenge: "",
    decision: ""
  };

  // Hidratar
  const { data } = await supabase
    .from("mindset_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  if (data) {
    Object.assign(state, {
      mood: data.mood ?? 3,
      enfoque: data.enfoque ?? 3,
      energia: data.energia ?? 3,
      motivacion: data.motivacion ?? 3,
      claridad: data.claridad ?? 3,
      confianza: data.confianza ?? 3
    });

    if (data.notes) {
      try {
        const n = JSON.parse(data.notes);
        state.best = n.best || "";
        state.challenge = n.challenge || "";
        state.decision = n.decision || "";
      } catch {}
    }
  }

  // Aplicar a UI
  qa("#mindsetMoodRow button").forEach(btn => {
    btn.classList.toggle(
      "active",
      Number(btn.dataset.value) === state.mood
    );
  });

  Object.entries(sliders).forEach(([k, el]) => {
    if (el) el.value = state[k];
  });

  Object.entries(notes).forEach(([k, el]) => {
    if (el) el.value = state[k];
  });

  let t = null;

  async function save() {
    await supabase
      .from("mindset_logs")
      .upsert({
        user_id: userId,
        course_id: courseId,
        lesson_id: lesson.id,
        day: lesson.day,
        mood: state.mood,
        enfoque: state.enfoque,
        energia: state.energia,
        motivacion: state.motivacion,
        claridad: state.claridad,
        confianza: state.confianza,
        notes: JSON.stringify({
          best: state.best,
          challenge: state.challenge,
          decision: state.decision
        })
      }, {
        onConflict: "user_id,course_id,lesson_id"
      });
  }

  function debounceSave() {
    clearTimeout(t);
    t = setTimeout(save, 600);
  }

  // Bindings
  qa("#mindsetMoodRow button").forEach(btn => {
    btn.onclick = () => {
      state.mood = Number(btn.dataset.value);
      qa("#mindsetMoodRow button").forEach(b =>
        b.classList.toggle("active", b === btn)
      );
      debounceSave();
    };
  });

  Object.entries(sliders).forEach(([k, el]) => {
    el.addEventListener("input", () => {
      state[k] = Number(el.value);
      debounceSave();
    });
  });

  Object.entries(notes).forEach(([k, el]) => {
    el.addEventListener("input", () => {
      state[k] = el.value.trim();
      debounceSave();
    });
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
      await loadLessonBase(courseId, day);

    renderHeader(course, lesson, dayNum);
    renderContent(lesson);

    await initMissionCheckin({ userId: user.id, courseId, lesson });
    await initLessonReflection({ userId: user.id, courseId, lesson });
    await initMindset({ userId: user.id, courseId, lesson });

  } catch (e) {
    console.error("[lesson]", e);
    alert("No se pudo cargar la lección");
    window.location.href = "/dashboard/index.html";
  }
}

init();

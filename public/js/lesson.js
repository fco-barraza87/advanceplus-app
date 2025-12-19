// /js/lesson.js — Definitivo (robusto + compatible con HTML antiguo y nuevo)
import { supabase } from "/js/supabase.js";

// ================================
// Mindset State (fuente única de verdad)
// ================================
const mindsetState = {
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

let isInsideMindset = false;

/* ============================================================
   Helpers DOM (con fallback entre versiones de HTML)
============================================================ */
const q = (sel) => document.querySelector(sel);
const qa = (sel) => Array.from(document.querySelectorAll(sel));

function firstEl(...sels) {
  for (const s of sels) {
    const el = q(s);
    if (el) return el;
  }
  return null;
}

function firstVal(...sels) {
  const el = firstEl(...sels);
  return el ? el.value : "";
}

function setText(el, text) {
  if (el) el.textContent = text ?? "";
}

function setHTML(el, html) {
  if (el) el.innerHTML = html ?? "";
}

function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function isTrue(v) {
  if (v === true) return true;
  if (v === 1) return true;
  if (typeof v === "string") return v === "t" || v === "true";
  return false;
}

function safeJson(obj) {
  try { return obj ? JSON.stringify(obj) : null; } catch { return null; }
}

function getQueryParam(key) {
  return new URL(window.location.href).searchParams.get(key);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================================
   Auth / Profile
============================================================ */
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function loadUserProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, goals_json, coach_style, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[lesson] loadUserProfile error:", error);
    return { id: userId, goals_json: {}, coach_style: "neutro" };
  }

  return data || { id: userId, goals_json: {}, coach_style: "neutro" };
}


/* ============================================================
   Load core data
============================================================ */
async function loadLessonData(userId, courseId, day) {
  const dayNum = Number(day) || 1;

  const { data: course, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (cErr) throw new Error("Error cargando curso: " + cErr.message);
  if (!course) throw new Error("Curso no encontrado para ese id.");

  const { data: lesson, error: lErr } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();
  if (lErr) throw new Error("Error cargando lección: " + lErr.message);

  if (!lesson) throw new Error(`No existe lección para el día ${dayNum} en este curso.`);

  const { data: progress, error: pErr } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();
  if (pErr) console.warn("[lesson] progress error (no crítico):", pErr);

  let reflection = null;
  try {
    const { data: refData, error: rErr } = await supabase
      .from("lesson_reflections")
      .select("id, content")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    if (rErr) console.warn("[lesson] reflection error:", rErr);
    reflection = refData || null;
  } catch (e) {
    console.warn("[lesson] reflection opcional:", e);
  }

  let feedback = null;
  try {
    const { data: fbData, error: fbErr } = await supabase
      .from("lesson_feedback")
      .select("id, rating, comment")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    if (fbErr) console.warn("[lesson] feedback error:", fbErr);
    feedback = fbData || null;
  } catch (e) {
    console.warn("[lesson] feedback opcional:", e);
  }

  return { course, lesson, progress, reflection, feedback };
}

/* ============================================================
   Render header + content (ambos HTMLs)
============================================================ */
function renderHeader(course, lesson, dayNum) {
  const backBtn = firstEl("#lessonBackBtn", "#btnBackToCourse");
  const courseLabel = firstEl("#lessonCourseLabel");
  const titleEl = firstEl("#lessonTitle");
  const subtitleEl = firstEl("#lessonSubtitle");
  const metaEl = firstEl("#lessonMeta");

  if (backBtn) backBtn.onclick = () => {
    window.location.href = `/curso/index.html?c=${course.id}`;
  };

  setText(courseLabel, `${course.category || "Reto"} · ${course.title}`);
  setText(titleEl, lesson.title || `Día ${dayNum}`);
  setText(subtitleEl, lesson.subtitle || "");
  setText(metaEl, `Día ${dayNum} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 25}`);

  // Mini-line ai_meta (si existe en HTML “bonito”)
  const line = firstEl("#lessonAiMetaLine");
  const m = lesson.ai_meta || null;
  if (line && m) {
    const parts = [];
    if (m.day_theme) parts.push(`Tema: ${m.day_theme}`);
    if (m.phase) parts.push(`Fase: ${m.phase}`);
    if (m.coach_focus) parts.push(`Enfoque: ${m.coach_focus}`);
    line.textContent = parts.join(" · ");
    line.style.display = parts.length ? "block" : "none";
  }
}

function renderContent(lesson) {
  const contentEl = firstEl("#lessonContent", "#lessonContentHtml");
  const mediaEl = firstEl("#lessonMedia");
  const exerciseTextEl = firstEl("#lessonExerciseText");

  if (contentEl) {
    if (lesson.content_html) contentEl.innerHTML = lesson.content_html;
    else if (lesson.text_content) contentEl.innerHTML = lesson.text_content;
    else contentEl.textContent = "Muy pronto verás aquí el contenido completo de esta lección.";
  }

  if (mediaEl) {
    mediaEl.innerHTML = "";

    if (lesson.audio_url) {
      const a = document.createElement("audio");
      a.controls = true;
      a.src = lesson.audio_url;
      a.className = "lesson-audio-player";
      mediaEl.appendChild(a);
    }

    if (lesson.video_url) {
      const v = document.createElement("video");
      v.controls = true;
      v.src = lesson.video_url;
      v.className = "lesson-video-player";
      mediaEl.appendChild(v);
    }

    if (lesson.meditation_url) {
      const m = document.createElement("audio");
      m.controls = true;
      m.src = lesson.meditation_url;
      m.className = "lesson-audio-player";
      mediaEl.appendChild(m);
    }

    if (lesson.image_url) {
      const img = document.createElement("img");
      img.src = lesson.image_url;
      img.alt = lesson.title || "Imagen de la lección";
      img.className = "lesson-image";
      mediaEl.appendChild(img);
    }
  }

  if (exerciseTextEl) {
    exerciseTextEl.innerHTML = lesson.exercise_content || exerciseTextEl.innerHTML || "";
  }
}

/* ============================================================
   Reflection autosave (compatible IDs)
============================================================ */
function getReflectionTextarea() {
  return firstEl("#lessonReflectionInput", "#lessonExerciseInput");
}

async function saveReflection(userId, courseId, lesson) {
  const ta = getReflectionTextarea();
  if (!ta) return;

  const content = (ta.value || "").trim();

  try {
    const { data: existing } = await supabase
      .from("lesson_reflections")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("lesson_reflections").update({ content }).eq("id", existing.id);
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
    console.warn("[lesson] saveReflection error:", e);
  }
}

function initReflectionAutosave(userId, courseId, lesson, reflection) {
  const ta = getReflectionTextarea();
  if (!ta) return;

  if (reflection?.content) ta.value = reflection.content;

  let t = null;
  ta.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => saveReflection(userId, courseId, lesson), 800);
  });

  ta.addEventListener("blur", () => saveReflection(userId, courseId, lesson));
  setInterval(() => saveReflection(userId, courseId, lesson), 5000);
}

/* ============================================================
   Feedback (colapsado) + stars
============================================================ */
function setupFeedbackStars() {
  const container = firstEl("#feedbackStars");
  if (!container) return;

  container.innerHTML = "";
  container.dataset.selected = "3"; // ⭐ default visual

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "feedback-star";
    star.dataset.value = String(i);
    star.textContent = "★";

    star.onclick = async () => {
      const value = Number(star.dataset.value);
      container.dataset.selected = String(value);

      Array.from(container.children).forEach((child) => {
        const v = Number(child.dataset.value);
        child.classList.toggle("selected", v <= value);
      });

      await saveFeedback(
        (await getCurrentUser()).id,
        getQueryParam("c"),
        window.__currentLesson
      );
    };

    container.appendChild(star);
  }
}

function initFeedbackAutosave() {
  const commentEl = firstEl("#feedbackComment");
  if (!commentEl) return;

  let t = null;

  commentEl.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const user = await getCurrentUser();
      if (!user || !window.__currentLesson) return;

      await saveFeedback(
        user.id,
        getQueryParam("c"),
        window.__currentLesson
      );
    }, 600);
  });
}


function initFeedbackCollapse() {
  const toggle = firstEl("#toggleFeedback");
  const form = firstEl("#feedbackForm");

  if (!toggle) return;

  toggle.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // 🔒 CLAVE: no burbujea a mindset

    if (form) {
      form.classList.remove("hidden");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // fallback: mostrar todo el bloque feedback
    const section = toggle.closest(".lesson-feedback-section");
    if (section) {
      section.classList.remove("hidden");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
}



function initFeedbackCTA() {
  const cta = firstEl("#feedbackCta");
  const form = firstEl("#feedbackForm");

  if (!cta || !form) return;

  cta.style.cursor = "pointer";

  cta.onclick = () => {
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}


function restoreFeedback(feedback) {
  const starsContainer = firstEl("#feedbackStars");
  const commentEl = firstEl("#feedbackComment");
  if (!starsContainer) return;

  const rating =
    feedback && typeof feedback.rating === "number" && feedback.rating >= 1
      ? feedback.rating
      : 3; // ⭐ default

  starsContainer.dataset.selected = String(rating);

  Array.from(starsContainer.children).forEach((child) => {
    const val = Number(child.dataset.value);
    child.classList.toggle("selected", val <= rating);
  });

  if (commentEl && typeof feedback?.comment === "string") {
    commentEl.value = feedback.comment;
  }
}


async function saveFeedback(userId, courseId, lesson) {
  const starsContainer = firstEl("#feedbackStars");
  const commentEl = firstEl("#feedbackComment");
  if (!starsContainer) return;

  const rating = Number(starsContainer.dataset.selected || 0);
  const comment = commentEl ? commentEl.value.trim() : "";
  if (!rating && !comment) return;

  try {
    const { data: existing } = await supabase
      .from("lesson_feedback")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("lesson_feedback").update({
        rating: rating || null,
        comment: comment || null
      }).eq("id", existing.id);
    } else {
      await supabase.from("lesson_feedback").insert({
        user_id: userId,
        course_id: courseId,
        lesson_id: lesson.id,
        day: lesson.day,
        rating: rating || null,
        comment: comment || null
      });
    }

    const msg = firstEl("#feedbackSavedMsg");
    if (msg) {
      msg.style.display = "block";
      setTimeout(() => (msg.style.display = "none"), 1200);
    }
  } catch (e) {
    console.warn("[lesson] saveFeedback error:", e);
  }
}

/* ============================================================
   Mission checkin — FIX definitivo (guarda note correctamente)
============================================================ */
async function initMissionCheckin(userId, courseId, lesson) {
  const dayNum = Number(lesson.day) || 1;
  if (dayNum <= 1) return;

  const root = firstEl("#missionCheckinCard", "#missionCheckinBlock");
  if (!root) return;

  const noteEl = firstEl("#missionCheckinNote");
  if (!noteEl) return;

  // buscar lección anterior
  const { data: prevLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", dayNum - 1)
    .maybeSingle();

  if (!prevLesson?.id) return;

  // cargar existente (si existe)
  const { data: existing } = await supabase
    .from("mission_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", prevLesson.id)
    .maybeSingle();

  let selectedResult = existing?.result || null;
  if (existing?.note) noteEl.value = existing.note;

  show(root);

  // botones resultado → SOLO seleccionan
  qa("button[data-result]", root).forEach((btn) => {
    btn.onclick = () => {
      selectedResult = btn.dataset.result;

      qa("button[data-result]", root).forEach(b =>
        b.classList.toggle("active", b === btn)
      );

      debounceSave();
    };
  });

  // autosave del texto
  noteEl.addEventListener("input", debounceSave);

  let t = null;
  function debounceSave() {
    clearTimeout(t);
    t = setTimeout(saveCheckin, 600);
  }

  async function saveCheckin() {
    if (!selectedResult) return;

    const row = {
      user_id: userId,
      course_id: courseId,
      lesson_id: prevLesson.id,
      day: dayNum - 1,
      result: selectedResult,
      note: noteEl.value.trim() || null
    };

    const { error } = await supabase
      .from("mission_checkins")
      .upsert(row, { onConflict: "user_id,course_id,lesson_id" });

    if (error) {
      console.warn("[mission_checkin] save error:", error);
    }
  }
}



/* ============================================================
   Mindset inline (autosave, sin botones)
============================================================ */
function initMindsetUI() {
  const root = firstEl("#mindsetInline", "#lessonMindsetBlock");
  if (root) {
    root.addEventListener("mouseenter", () => {
      isInsideMindset = true;
    });
    root.addEventListener("mouseleave", () => {
      isInsideMindset = false;
    });
  }
  const moodRow = firstEl("#mindsetMoodRow");

  if (moodRow) {
    moodRow.dataset.value = String(mindsetState.mood);

    qa("button[data-value]", moodRow).forEach((btn) => {
      btn.onclick = () => {
        const raw = btn.dataset.value;
        if (raw === undefined) return;
        const v = Number(raw);

        if (!Number.isInteger(v) || v < 1 || v > 5) {
          console.warn("[mindset] mood inválido:", raw);
          return;
        }

        mindsetState.mood = v;
        moodRow.dataset.value = String(v);

        qa("button", moodRow).forEach((b) =>
          b.classList.toggle("active", b === btn)
        );

        debounceSaveMindset();
      };
    });

  }

  const sliders = [
    ["mindsetFocus", "enfoque"],
    ["mindsetEnergy", "energia"],
    ["mindsetMotivation", "motivacion"],
    ["mindsetClarity", "claridad"],
    ["mindsetConfidence", "confianza"]
  ];

  sliders.forEach(([id, key]) => {
    const input = firstEl("#" + id);
    if (!input) return;

    input.value = mindsetState[key];
    input.addEventListener("input", () => {
      mindsetState[key] = Number(input.value);
      debounceSaveMindset();
    });
  });

  const bindText = (id, key) => {
    const el = firstEl(id);
    if (!el) return;
    el.addEventListener("input", () => {
      mindsetState[key] = el.value.trim();
      debounceSaveMindset();
    });
  };

  bindText("#mindsetNoteBest", "best");
  bindText("#mindsetNoteChallenge", "challenge");
  bindText("#mindsetNoteDecision", "decision");
}


/* ============================================================
   Load Mindset from DB (DB → UI → State)
============================================================ */
async function loadMindsetForLesson(userId, courseId, lesson) {
  const { data, error } = await supabase
    .from("mindset_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return;

  // ---------- STATE ----------
  mindsetState.mood = data.mood ?? 3;
  mindsetState.enfoque = data.enfoque ?? 3;
  mindsetState.energia = data.energia ?? 3;
  mindsetState.motivacion = data.motivacion ?? 3;
  mindsetState.claridad = data.claridad ?? 3;
  mindsetState.confianza = data.confianza ?? 3;

  if (data.notes) {
    try {
      const n = JSON.parse(data.notes);
      mindsetState.best = n.best || "";
      mindsetState.challenge = n.challenge || "";
      mindsetState.decision = n.decision || "";
    } catch {}
  }

  // ---------- UI ----------
  const moodRow = q("#mindsetMoodRow");
  if (moodRow) {
    moodRow.dataset.value = String(mindsetState.mood);
    qa("button", moodRow).forEach(btn => {
      btn.classList.toggle(
        "active",
        Number(btn.dataset.value) === mindsetState.mood
      );
    });
  }

  const map = [
    ["mindsetFocus", "enfoque"],
    ["mindsetEnergy", "energia"],
    ["mindsetMotivation", "motivacion"],
    ["mindsetClarity", "claridad"],
    ["mindsetConfidence", "confianza"]
  ];

  map.forEach(([id, key]) => {
    const input = q("#" + id);
    if (input) input.value = mindsetState[key];
  });

  if (q("#mindsetNoteBest")) q("#mindsetNoteBest").value = mindsetState.best;
  if (q("#mindsetNoteChallenge")) q("#mindsetNoteChallenge").value = mindsetState.challenge;
  if (q("#mindsetNoteDecision")) q("#mindsetNoteDecision").value = mindsetState.decision;
}


async function hasMindsetLogForLesson(userId, courseId, lessonId) {
  const { data, error } = await supabase
    .from("mindset_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

async function saveMindsetLog(userId, courseId, lesson) {
  const payload = {
    user_id: userId,
    course_id: courseId,
    lesson_id: lesson.id,
    day: lesson.day,

    mood: mindsetState.mood,
    enfoque: mindsetState.enfoque,
    energia: mindsetState.energia,
    motivacion: mindsetState.motivacion,
    claridad: mindsetState.claridad,
    confianza: mindsetState.confianza,

    notes:
      mindsetState.best ||
      mindsetState.challenge ||
      mindsetState.decision
        ? JSON.stringify({
            best: mindsetState.best,
            challenge: mindsetState.challenge,
            decision: mindsetState.decision
          })
        : null
  };

  try {
    const { error } = await supabase
      .from("mindset_logs")
      .upsert(payload, {
        onConflict: "user_id,course_id,lesson_id"
      });

    if (error) {
      console.warn("[mindset] upsert error:", error);
      return false;
    }

    console.log("[mindset] upsert OK", payload);
    return true;
  } catch (e) {
    console.warn("[mindset] unexpected error:", e);
    return false;
  }
}


let mindsetSaveTimeout = null;

function debounceSaveMindset() {
  if (!isInsideMindset) return;

  clearTimeout(mindsetSaveTimeout);
  mindsetSaveTimeout = setTimeout(async () => {
    const user = await getCurrentUser();
    if (!user || !window.__currentLesson) return;

    await saveMindsetLog(
      user.id,
      getQueryParam("c"),
      window.__currentLesson
    );
  }, 700);
}



/* ============================================================
   Progress + Redirect
============================================================ */
async function completeLesson(userId, course, lesson) {
  const xp = lesson.xp_reward || 0;

  const { error } = await supabase.rpc("finish_lesson", {
    p_user_id: userId,
    p_course_id: course.id,
    p_day: lesson.day,
    p_xp: xp
  });

  if (error) {
    console.error("[lesson] finish_lesson error:", error);
    alert("No se pudo completar la lección (RPC).");
    return false;
  }
  return true;
}

async function computeNextDayForRedirect(userId, course) {
  const { data: allProgress, error } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .order("day", { ascending: true });

  if (error) console.warn("[lesson] progress read error:", error);

  const totalDays = course.duration_days || 1;
  const completedDays = (allProgress || []).filter((p) => isTrue(p.completed));
  const lastCompleted = completedDays.length ? completedDays[completedDays.length - 1].day : 0;

  let nextDay = lastCompleted + 1;
  if (nextDay > totalDays) nextDay = totalDays;

  const finished = completedDays.length >= totalDays;
  return { nextDay, totalDays, finished };
}

function redirectAfterLesson(course, lesson, redirectInfo) {
  const { nextDay, totalDays, finished } = redirectInfo;
  if (finished && lesson.day >= totalDays) {
    window.location.href = `/curso/index.html?c=${course.id}`;
  } else {
    window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
  }
}

/* ============================================================
   Coach: activación + card persistente + chat
============================================================ */
async function hasActiveCoach(courseId) {
  // 1) RPC (si existe)
  try {
    const user = (await supabase.auth.getUser())?.data?.user;
    if (!user) return false;

    const { data, error } = await supabase.rpc("has_active_coach", {
      p_user: user.id,
      p_course: courseId
    });

    if (!error && data === true) return true;
  } catch (e) {
    // ignorar
  }

  // 2) fallback a tabla user_coach_access
  try {
    const user = (await supabase.auth.getUser())?.data?.user;
    if (!user) return false;

    const { data } = await supabase
      .from("user_coach_access")
      .select("active")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    return data?.active === true;
  } catch (e) {
    return false;
  }
}

async function callCoachEngine(payload) {
  // Si aún no tienes Edge Function, devolvemos null silencioso.
  try {
    const session = (await supabase.auth.getSession())?.data?.session;
    if (!session?.access_token) return null;

    const res = await fetch(
      "https://lmlfvbzukymtkcyfromr.supabase.co/functions/v1/coach-engine",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function renderCoachBlocks(blocks) {
  let html = "";
  (blocks || []).forEach((b) => {
    html += `<div class="coach-block coach-${escapeHtml(b.type || "text")}">`;
    if (b.title) html += `<h4>${escapeHtml(b.title)}</h4>`;
    if (b.text) html += `<p>${escapeHtml(b.text)}</p>`;
    html += `</div>`;
  });
  return html;
}

function setCoachCardContent(html) {
  // HTML bonito usa #coachCardContent; HTML nuevo usa #coachMessage
  const contentA = firstEl("#coachCardContent");
  const contentB = firstEl("#coachMessage");
  if (contentA) contentA.innerHTML = html || "";
  if (contentB) contentB.innerHTML = html || "";
}

function showCoachCard() {
  const cardA = firstEl("#coachCard");
  const cardB = firstEl("#lessonCoachBlock");
  if (cardA) show(cardA);
  if (cardB) show(cardB);
}

async function showCoachCardIfActive({ course, lesson, profile, actionType, userInput }) {
  const enabled = await hasActiveCoach(course.id);
  if (!enabled) return false;

  const payload = {
    intent: "coach_card",
    action_type: actionType,     // "pre_lesson" | "post_lesson" | "post_mindset" | "refresh"
    course_id: course.id,
    lesson_id: lesson.id,
    day: lesson.day,
    user_input: userInput || null,
    ai_meta: lesson.ai_meta || null,
    user_goals: profile?.goals_json || {},
    coach_style_preference: profile?.coach_style || profile?.goals_json?.coach_style || "neutro"
  };

  const resp = await callCoachEngine(payload);

  // Si no hay coach-engine aún, muestra algo mínimo coherente (no vacío)
  if (!resp) {
    const focus = lesson.ai_meta?.coach_focus ? `Hoy tu foco es **${lesson.ai_meta.coach_focus}**.` : "";
    const theme = lesson.ai_meta?.day_theme ? `Tema del día: **${lesson.ai_meta.day_theme}**.` : "";
    const fallback = `
      <div class="coach-block coach-text">
        <h4>Tu Coach</h4>
        <p>${escapeHtml([theme, focus].filter(Boolean).join(" ")) || "Hoy vamos a avanzar con intención."}</p>
        <p>Si quieres, abre el chat y dime qué te está costando más.</p>
      </div>
    `;
    setCoachCardContent(fallback);
    showCoachCard();
    return true;
  }

  if (resp?.blocks?.length) {
    setCoachCardContent(renderCoachBlocks(resp.blocks));
    showCoachCard();
    return true;
  }

  return false;
}

function initCoachChat({ course, lesson, profile }) {
  const openBtn = firstEl("#openCoachChatBtn");
  const chatBox = firstEl("#coachChat", "#lessonChatBlock");
  const messages = firstEl("#coachChatMessages");
  const input = firstEl("#coachChatInput");
  const sendBtn = firstEl("#coachChatSend");
  const refreshBtn = firstEl("#coachCardRefreshBtn");

  // Si no existe UI de chat, salimos (no rompemos)
  if (!openBtn || !chatBox || !messages || !input || !sendBtn) return;

  openBtn.onclick = () => {
    show(chatBox);
    if (!messages.hasChildNodes()) {
      const div = document.createElement("div");
      div.className = "coach-msg coach";
      div.textContent = "Estoy aquí contigo. ¿Qué quieres trabajar ahora?";
      messages.appendChild(div);
    }
    input.focus();
  };

  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      await showCoachCardIfActive({
        course,
        lesson,
        profile,
        actionType: "refresh",
        userInput: ""
      });
    };
  }

  sendBtn.onclick = sendMessage;
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  async function sendMessage() {
    const text = (input.value || "").trim();
    if (!text) return;

    addMsg("user", text);
    input.value = "";

    const enabled = await hasActiveCoach(course.id);
    if (!enabled) {
      addMsg("coach", "Tu Coach IA no está activo para este curso aún.");
      return;
    }

    const resp = await callCoachEngine({
      intent: "chat",
      action_type: "chat",
      course_id: course.id,
      lesson_id: lesson.id,
      day: lesson.day,
      user_input: text,
      ai_meta: lesson.ai_meta || null,
      user_goals: profile?.goals_json || {},
      coach_style_preference: profile?.coach_style || profile?.goals_json?.coach_style || "neutro"
    });

    if (resp?.text) addMsg("coach", resp.text);
    else addMsg("coach", "Te leí. Dame 1 frase: ¿qué te frenó hoy exactamente?");

    function addMsg(who, t) {
      const div = document.createElement("div");
      div.className = `coach-msg ${who}`;
      div.textContent = t;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
  }
}

/* ============================================================
   Navigation prev/next (HTML bonito)
============================================================ */
function initNavigation({ course, courseId, dayNum, completed }) {
  const prevBtn = firstEl("#prevLessonBtn");
  const nextBtn = firstEl("#nextLessonBtn");
  const totalDays = course.duration_days || 1;

  if (prevBtn) {
    if (dayNum > 1) {
      prevBtn.onclick = () => window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum - 1}`;
    } else {
      prevBtn.disabled = true;
      prevBtn.style.opacity = "0.4";
    }
  }

  if (nextBtn) {
    if (dayNum < totalDays) {
      if (completed) {
        nextBtn.onclick = () => window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum + 1}`;
      } else {
        nextBtn.disabled = true;
        nextBtn.style.opacity = "0.4";
        nextBtn.textContent = "Completa esta lección para continuar →";
      }
    } else {
      nextBtn.disabled = true;
      nextBtn.textContent = "Fin del curso 🎉";
      nextBtn.style.opacity = "0.4";
    }
  }
}

/* ============================================================
   Complete flow (inline)
   - Completar lección -> mostrar mindset inline (si no existe)
   - Guardar mindset -> coach post_mindset -> redirect
============================================================ */
async function initCompleteFlow({ userId, course, courseId, lesson, profile, progress, dayNum }) {
  const completed = progress ? isTrue(progress.completed) : false;

  const completeBtn = firstEl("#completeLessonBtn", "#btnCompleteLesson");
  const mindsetInline = firstEl("#mindsetInline", "#lessonMindsetBlock");
  const mindsetSaveBtn = firstEl("#mindsetSaveBtn");
  const nextBtn = firstEl("#nextLessonBtn");

  if (completed) {
    if (completeBtn) {
      completeBtn.outerHTML = `
        <button class="btn completed-badge" disabled>
          ✓ Lección ya completada
        </button>
      `;
    }
    return;
  }

  if (!completeBtn) return;

  completeBtn.onclick = async () => {
    const ok = await completeLesson(userId, course, lesson);
    if (!ok) return;

    await showCoachCardIfActive({
      course,
      lesson,
      profile,
      actionType: "post_lesson",
      userInput: ""
    });

    const redirectInfo = await computeNextDayForRedirect(userId, course);
    redirectAfterLesson(course, lesson, redirectInfo);
  };


  if (mindsetSaveBtn) {
    mindsetSaveBtn.onclick = async () => {
      const saved = await saveMindsetLog(userId, courseId, lesson);
      if (!saved) {
        alert("No se pudo guardar el mindset. Intenta nuevamente.");
        return;
      }

      // coach después del mindset (si está activo)
      await showCoachCardIfActive({
        course,
        lesson,
        profile,
        actionType: "post_mindset",
        userInput: safeJson({
          reflection: (getReflectionTextarea()?.value || "").trim(),
          feedback: (firstVal("#feedbackComment") || "").trim(),
          mood: firstEl("#mindsetMoodRow")?.dataset?.selected || firstEl("#mindsetMoodRow")?.dataset?.value || null
        })
      });

      const redirectInfo = await computeNextDayForRedirect(userId, course);
      redirectAfterLesson(course, lesson, redirectInfo);
    };
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
  const dayNum = Number(getQueryParam("day") || "1") || 1;

  if (!courseId) {
    alert("No se ha especificado el curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  try {
    const profile = await loadUserProfile(user.id);
    const { course, lesson, progress, reflection, feedback } =
      await loadLessonData(user.id, courseId, dayNum);
      window.__currentLesson = lesson;


    // Render
    renderHeader(course, lesson, dayNum);
    renderContent(lesson);

    // Reflection autosave
    initReflectionAutosave(user.id, courseId, lesson, reflection);

    // Feedback
    setupFeedbackStars();
    restoreFeedback(feedback);
    initFeedbackAutosave();
    initFeedbackCollapse();
    initFeedbackCTA();


    // Mindset UI
    initMindsetUI();
    await loadMindsetForLesson(user.id, courseId, lesson);


    // Mission checkin
    await initMissionCheckin(user.id, courseId, lesson);



    /* ==================================================
       🔧 MEJORA 1: Día 1 → Coach NO sticky
    ================================================== */
    const coachBlock = document.querySelector("#lessonCoachBlock");
    if (coachBlock && lesson.day === 1) {
      coachBlock.classList.remove("sticky-coach");
    }

    // Chat coach
    initCoachChat({ course, lesson, profile });

    // Navigation (si existe)
    initNavigation({
      course,
      courseId,
      dayNum,
      completed: progress ? isTrue(progress.completed) : false
    });

    /* ==================================================
       🔧 MEJORA 2: Mostrar CTA si NO está completada
    ================================================== */
    const ctaBlock = document.querySelector("#lessonCtaBlock");
    const isCompleted =
      progress &&
      (progress.completed === true ||
        progress.completed === "t" ||
        progress.completed === 1);

    if (ctaBlock && !isCompleted) {
      ctaBlock.classList.remove("hidden");
    }

    // Complete flow (inline)
    await initCompleteFlow({
      userId: user.id,
      course,
      courseId,
      lesson,
      profile,
      progress,
      dayNum
    });

  } catch (e) {
    console.error("[lesson] init error:", e);
    alert(e.message || "No se pudo cargar la lección.");
    window.location.href = "/dashboard/index.html";
  }
}


init();

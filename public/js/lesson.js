// /js/lesson.js — Definitivo (robusto + compatible con HTML antiguo y nuevo)
import { supabase } from "/js/supabase.js";

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
  container.dataset.selected = "0";

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "feedback-star";
    star.dataset.value = String(i);
    star.textContent = "★";
    star.style.cursor = "pointer";

    star.onclick = () => {
      const value = Number(star.dataset.value);
      container.dataset.selected = String(value);
      Array.from(container.children).forEach((child) => {
        const v = Number(child.dataset.value);
        child.classList.toggle("selected", v <= value);
      });
    };

    container.appendChild(star);
  }
}

function initFeedbackCollapse() {
  // HTML nuevo
  const toggle = firstEl("#toggleFeedback");
  const form = firstEl("#feedbackForm");
  if (toggle && form) {
    toggle.onclick = () => form.classList.toggle("hidden");
    return;
  }

  // HTML antiguo (si quieres colapsarlo sin re-estructurar HTML)
  // Si NO existe toggleFeedback, no tocamos nada.
}

function restoreFeedback(feedback) {
  const starsContainer = firstEl("#feedbackStars");
  const commentEl = firstEl("#feedbackComment");
  if (!starsContainer) return;

  if (feedback && typeof feedback.rating === "number" && feedback.rating > 0) {
    starsContainer.dataset.selected = String(feedback.rating);
    Array.from(starsContainer.children).forEach((child) => {
      const val = Number(child.dataset.value);
      child.classList.toggle("selected", val <= feedback.rating);
    });
  }

  if (commentEl && feedback?.comment) commentEl.value = feedback.comment;
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
  const moodRow = firstEl("#mindsetMoodRow");

  if (moodRow) {
    if (!moodRow.dataset.value) {
      moodRow.dataset.value = "3";
    }

    const btns = Array.from(moodRow.querySelectorAll("button"));
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.value;
        moodRow.dataset.value = v;
        btns.forEach((b) => b.classList.toggle("active", b === btn));
        debounceSaveMindset();
      });
    });
  }

  const sliders = [
    "mindsetFocus",
    "mindsetEnergy",
    "mindsetMotivation",
    "mindsetClarity",
    "mindsetConfidence"
  ];

  sliders.forEach((id) => {
    const input = firstEl("#" + id);
    if (!input) return;
    input.addEventListener("input", debounceSaveMindset);
  });

  const decision = firstEl("#mindsetNoteDecision");
  if (decision) {
    decision.addEventListener("input", debounceSaveMindset);
  }
}

/* -------------------------
   Autosave mindset
-------------------------- */
let mindsetTimeout = null;

function debounceSaveMindset() {
  clearTimeout(mindsetTimeout);
  mindsetTimeout = setTimeout(saveMindsetAuto, 600);
}

async function saveMindsetAuto() {
  const user = await getCurrentUser();
  if (!user || !window.__currentLesson) return;

  await saveMindsetLog(
    user.id,
    getQueryParam("c"),
    window.__currentLesson
  );
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
  const moodRow = firstEl("#mindsetMoodRow");
  const mood = moodRow?.dataset.selected || moodRow?.dataset.value || null;

  const enfoque = Number(firstEl("#mindsetFocus")?.value || 0) || null;
  const energia = Number(firstEl("#mindsetEnergy")?.value || 0) || null;
  const motivacion = Number(firstEl("#mindsetMotivation")?.value || 0) || null;
  const claridad = Number(firstEl("#mindsetClarity")?.value || 0) || null;
  const confianza = Number(firstEl("#mindsetConfidence")?.value || 0) || null;

  // preguntas (solo en HTML bonito)
  const best = (firstVal("#mindsetNoteBest") || "").trim();
  const challenge = (firstVal("#mindsetNoteChallenge") || "").trim();
  const decision = (firstVal("#mindsetNoteDecision") || "").trim();
  const notes = (best || challenge || decision) ? safeJson({ best, challenge, decision }) : null;

  try {
    await supabase.from("mindset_logs").insert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lesson.id,
      day: lesson.day,
      mood: mood ? Number(mood) : null,
      enfoque, energia, motivacion, claridad, confianza,
      notes
    });
    return true;
  } catch (e) {
    console.warn("[lesson] saveMindsetLog error:", e);
    return false;
  }
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
    // 1) guardar entradas
    await saveReflection(userId, courseId, lesson);
    await saveFeedback(userId, courseId, lesson);

    // 2) marcar progreso
    const ok = await completeLesson(userId, course, lesson);
    if (!ok) return;

    // 🔁 Reordenar visual final: Mindset → Coach → Feedback → Chat
    const coachBlock = document.querySelector("#lessonCoachBlock");
    const feedbackSection = document.querySelector(".lesson-feedback-section");
    const lessonChatBlock = document.querySelector("#lessonChatBlock");

    feedbackSection?.after(coachBlock);
    lessonChatBlock?.after(feedbackSection);


    // 3) habilitar siguiente (si existe)
    const totalDays = course.duration_days || 1;
    if (nextBtn && dayNum < totalDays) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = "1";
      nextBtn.textContent = "Siguiente lección →";
      nextBtn.onclick = () => window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum + 1}`;
    }

    // 4) si ya hay mindset log, redirect directo (pero actualizamos coach post_lesson)
    const alreadyLogged = await hasMindsetLogForLesson(userId, courseId, lesson.id);
    if (alreadyLogged) {
      await showCoachCardIfActive({
        course,
        lesson,
        profile,
        actionType: "post_lesson",
        userInput: ((firstVal("#feedbackComment") || "") + " " + (getReflectionTextarea()?.value || "")).trim()
      });

      const redirectInfo = await computeNextDayForRedirect(userId, course);
      redirectAfterLesson(course, lesson, redirectInfo);
      return;
    }

    // 5) mostrar mindset inline
    if (mindsetInline) {
      show(mindsetInline);
      mindsetInline.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // si no hay bloque, hacemos redirect igual (no rompemos)
      const redirectInfo = await computeNextDayForRedirect(userId, course);
      redirectAfterLesson(course, lesson, redirectInfo);
    }
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
    initFeedbackCollapse();

    // Mindset UI
    initMindsetUI();

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

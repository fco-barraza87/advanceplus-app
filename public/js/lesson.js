// /js/lesson.js (Step3 definitivo)
import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

/* ==========================================
   Helpers
========================================== */
function safeJson(obj) {
  try { return obj ? JSON.stringify(obj) : null; } catch { return null; }
}

function isTrue(v) {
  if (v === true) return true;
  if (v === 1) return true;
  if (typeof v === "string") return v === "t" || v === "true";
  return false;
}

/* ==========================================
   Auth / Profile
========================================== */
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function loadUserProfile(userId) {
  // NOTA: ajusta select si tu tabla profiles tiene otros nombres
  const { data, error } = await supabase
    .from("profiles")
    .select("id, goals_json, coach_style, full_name, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[lesson] loadUserProfile error:", error);
    return { goals_json: {} };
  }
  return data || { goals_json: {} };
}

/* ==========================================
   Data: curso + lección + progreso + reflection + feedback
========================================== */
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
  if (pErr) console.warn("[lesson] Error cargando progreso (no crítico):", pErr);

  let reflection = null;
  try {
    const { data: refData, error: rErr } = await supabase
      .from("lesson_reflections")
      .select("id, content")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    if (rErr) console.warn("[lesson] Error cargando reflexión:", rErr);
    reflection = refData || null;
  } catch (e) {
    console.warn("[lesson] reflexión opcional:", e);
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
    if (fbErr) console.warn("[lesson] Error cargando feedback:", fbErr);
    feedback = fbData || null;
  } catch (e) {
    console.warn("[lesson] feedback opcional:", e);
  }

  return { course, lesson, progress, reflection, feedback };
}

/* ==========================================
   Render
========================================== */
function renderLessonHeader(course, lesson, day) {
  const backBtn = qs("#lessonBackBtn");
  const courseLabel = qs("#lessonCourseLabel");
  const titleEl = qs("#lessonTitle");
  const subtitleEl = qs("#lessonSubtitle");
  const metaEl = qs("#lessonMeta");

  if (backBtn) backBtn.onclick = () => (window.location.href = `/curso/index.html?c=${course.id}`);

  if (courseLabel) courseLabel.textContent = `${course.category || "Reto"} · ${course.title}`;
  if (titleEl) titleEl.textContent = lesson.title || `Día ${day}`;
  if (subtitleEl) subtitleEl.textContent = lesson.subtitle || "";
  if (metaEl) metaEl.textContent = `Día ${day} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 25}`;

  // mini línea de ai_meta
  const line = qs("#lessonAiMetaLine");
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

function renderLessonContent(lesson) {
  const contentEl = qs("#lessonContent");
  const mediaEl = qs("#lessonMedia");
  const exerciseTextEl = qs("#lessonExerciseText");

  if (contentEl) {
    if (lesson.content_html) contentEl.innerHTML = lesson.content_html;
    else if (lesson.text_content) contentEl.innerHTML = lesson.text_content;
    else contentEl.textContent = "Muy pronto verás aquí el contenido completo de esta lección.";
  }

  if (mediaEl) {
    mediaEl.innerHTML = "";

    if (lesson.audio_url) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = lesson.audio_url;
      audio.className = "lesson-audio-player";
      mediaEl.appendChild(audio);
    }

    if (lesson.video_url) {
      const video = document.createElement("video");
      video.controls = true;
      video.src = lesson.video_url;
      video.className = "lesson-video-player";
      mediaEl.appendChild(video);
    }

    if (lesson.meditation_url) {
      const med = document.createElement("audio");
      med.controls = true;
      med.src = lesson.meditation_url;
      med.className = "lesson-audio-player";
      mediaEl.appendChild(med);
    }

    if (lesson.image_url) {
      const img = document.createElement("img");
      img.src = lesson.image_url;
      img.alt = lesson.title || "Imagen de la lección";
      img.className = "lesson-image";
      mediaEl.appendChild(img);
    }
  }

  if (exerciseTextEl && lesson.exercise_content) {
    exerciseTextEl.innerHTML = lesson.exercise_content;
  }
}

/* ==========================================
   Reflection / Feedback
========================================== */
async function saveReflection(userId, courseId, lesson) {
  const textarea = qs("#lessonReflectionInput");
  if (!textarea) return;

  const content = textarea.value.trim();

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
    console.error("❌ Error guardando reflexión:", e);
  }
}

function setupFeedbackStars() {
  const container = qs("#feedbackStars");
  if (!container) return;

  container.innerHTML = "";
  container.dataset.selected = "0";

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "feedback-star";
    star.dataset.value = String(i);
    star.textContent = "★";

    // clave: que siempre funcione aunque haya overlays
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

async function saveFeedback(userId, courseId, lesson) {
  const starsContainer = qs("#feedbackStars");
  const commentEl = qs("#feedbackComment");
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

    const msg = qs("#feedbackSavedMsg");
    if (msg) {
      msg.style.display = "block";
      setTimeout(() => (msg.style.display = "none"), 1300);
    }
  } catch (e) {
    console.warn("[lesson] No se pudo guardar feedback:", e);
  }
}

/* ==========================================
   Progress / Redirect
========================================== */
async function completeLesson(userId, course, lesson) {
  const xp = lesson.xp_reward || 0;

  const { data, error } = await supabase.rpc("finish_lesson", {
    p_user_id: userId,
    p_course_id: course.id,
    p_day: lesson.day,
    p_xp: xp
  });

  if (error) {
    console.error("❌ Error en finish_lesson:", error);
    alert("No se pudo completar la lección (error RPC).");
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

  if (error) console.warn("[lesson] Error leyendo progress para nextDay:", error);

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
  if (finished && lesson.day >= totalDays) window.location.href = `/curso/index.html?c=${course.id}`;
  else window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
}

/* ==========================================
   Mindset Inline
========================================== */
function initMindsetUI() {
  const moodRow = qs("#mindsetMoodRow");
  if (moodRow) {
    moodRow.dataset.selected = "3";
    Array.from(moodRow.children).forEach((btn) => {
      btn.addEventListener("click", () => {
        moodRow.dataset.selected = btn.dataset.value;
        Array.from(moodRow.children).forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
  }

  const sliders = [
    { id: "mindsetFocus", labelId: "mindsetFocusValue" },
    { id: "mindsetEnergy", labelId: "mindsetEnergyValue" },
    { id: "mindsetMotivation", labelId: "mindsetMotivationValue" },
    { id: "mindsetClarity", labelId: "mindsetClarityValue" },
    { id: "mindsetConfidence", labelId: "mindsetConfidenceValue" }
  ];

  sliders.forEach(({ id, labelId }) => {
    const input = qs("#" + id);
    const label = qs("#" + labelId);
    if (!input || !label) return;
    const update = () => (label.textContent = `${input.value} / 5`);
    input.addEventListener("input", update);
    update();
  });
}

async function hasMindsetLogForLesson(userId, courseId, lessonId) {
  try {
    const { data, error } = await supabase
      .from("mindset_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

async function saveMindsetLog(userId, courseId, lesson) {
  const moodRow = qs("#mindsetMoodRow");
  const moodValue = moodRow?.dataset.selected ? Number(moodRow.dataset.selected) : null;

  const enfoque = Number(qs("#mindsetFocus")?.value || null);
  const energia = Number(qs("#mindsetEnergy")?.value || null);
  const motivacion = Number(qs("#mindsetMotivation")?.value || null);
  const claridad = Number(qs("#mindsetClarity")?.value || null);
  const confianza = Number(qs("#mindsetConfidence")?.value || null);

  const best = qs("#mindsetNoteBest")?.value.trim() || "";
  const challenge = qs("#mindsetNoteChallenge")?.value.trim() || "";
  const decision = qs("#mindsetNoteDecision")?.value.trim() || "";

  const notes = best || challenge || decision ? safeJson({ best, challenge, decision }) : null;

  try {
    await supabase.from("mindset_logs").insert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lesson.id,
      day: lesson.day,
      mood: moodValue,
      enfoque, energia, motivacion, claridad, confianza,
      notes
    });
    return true;
  } catch (e) {
    console.warn("[lesson] No se pudo guardar mindset_logs:", e);
    return false;
  }
}

/* ==========================================
   Coach IA (card persistente + chat)
========================================== */
function showCoachCard() {
  const card = qs("#coachCard");
  if (card) card.classList.remove("hidden");
}
function setCoachCardContent(htmlBlocks) {
  const content = qs("#coachCardContent");
  if (!content) return;
  content.innerHTML = htmlBlocks || "";
}

function renderCoachBlocks(blocks) {
  // blocks: [{type,title,text}]
  let html = "";
  (blocks || []).forEach((b) => {
    html += `<div class="coach-block coach-${(b.type || "text")}">`;
    if (b.title) html += `<h4>${escapeHtml(b.title)}</h4>`;
    if (b.text) html += `<p>${escapeHtml(b.text)}</p>`;
    html += `</div>`;
  });
  return html;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function hasActiveCoach(courseId) {
  try {
    const user = (await supabase.auth.getUser())?.data?.user;
    if (!user) return false;

    const { data, error } = await supabase.rpc("has_active_coach", {
      p_user: user.id,
      p_course: courseId
    });

    if (error) {
      console.warn("[coach] has_active_coach error:", error);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn("[coach] hasActiveCoach exception:", e);
    return false;
  }
}

async function callCoachEngine(payload) {
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

    if (!res.ok) {
      console.warn("[coach] coach-engine error:", await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn("[coach] callCoachEngine exception:", e);
    return null;
  }
}

async function showCoachCardIfActive({ userId, course, lesson, profile, actionType, userInput }) {
  const active = await hasActiveCoach(course.id);
  if (!active) return false;

  const payload = {
    intent: "coach_card",
    action_type: actionType,
    course_id: course.id,
    lesson_id: lesson.id,
    day: lesson.day,
    user_input: userInput || null,

    // contexto extra (clave para coherencia y personalización)
    ai_meta: lesson.ai_meta || null,
    user_goals: profile?.goals_json || {},
    coach_style_preference: profile?.coach_style || profile?.goals_json?.coach_style || "neutro"
  };

  const resp = await callCoachEngine(payload);
  if (resp?.blocks?.length) {
    setCoachCardContent(renderCoachBlocks(resp.blocks));
    showCoachCard();
    return true;
  }
  return false;
}

function initCoachChat({ course, lesson, profile }) {
  const openBtn = qs("#openCoachChatBtn");
  const chatBox = qs("#coachChat");
  const messages = qs("#coachChatMessages");
  const input = qs("#coachChatInput");
  const sendBtn = qs("#coachChatSend");
  const refreshBtn = qs("#coachCardRefreshBtn");

  if (!openBtn || !chatBox || !messages || !input || !sendBtn) return;

  openBtn.onclick = () => {
    chatBox.classList.remove("hidden");
    // no ocultamos el botón: puede abrir/cerrar si quieres después
    if (!messages.hasChildNodes()) {
      addCoachMessage("Estoy aquí contigo. ¿Qué quieres trabajar ahora?");
    }
    input.focus();
  };

  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      await showCoachCardIfActive({
        userId: profile?.id,
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
    const text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = "";

    // Coach engine real (intent chat)
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

    if (resp?.text) addCoachMessage(resp.text);
    else addCoachMessage("Te leí. Vamos a convertir eso en una acción clara para mañana.");
  }

  function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "coach-msg user";
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addCoachMessage(text) {
    const div = document.createElement("div");
    div.className = "coach-msg coach";
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
}

/* ==========================================
   Mission Checkin (UPSERT para evitar 409)
========================================== */
async function initMissionCheckin(userId, courseId, dayNum) {
  if (dayNum <= 1) return;

  const card = qs("#missionCheckinCard");
  if (!card) return;

  // lección anterior
  const { data: prevLesson, error: plErr } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", dayNum - 1)
    .maybeSingle();
  if (plErr || !prevLesson?.id) return;

  // si ya existe, no mostrar
  const { data: existing } = await supabase
    .from("mission_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("lesson_id", prevLesson.id)
    .maybeSingle();
  if (existing?.id) return;

  card.classList.remove("hidden");

  const noteInput = qs("#missionCheckinNote");
  const skipBtn = qs("#missionCheckinSkip");

  card.querySelectorAll("button[data-result]").forEach((btn) => {
      btn.onclick = async () => {
        const row = {
          user_id: userId,
          course_id: courseId,
          lesson_id: prevLesson.id,
          day: dayNum - 1,
          result: btn.dataset.result,
          note: noteInput?.value || null
        };

        const { error } = await supabase
          .from("mission_checkins")
          .upsert(row, { onConflict: "user_id,course_id,lesson_id" });

        if (error) {
          console.warn("[lesson] mission_checkins upsert error:", error);
          return;
        }

        // 👉 NUEVO: feedback del coach específico
        await showCoachCardIfActive({
          userId,
          course: { id: courseId },
          lesson: { id: prevLesson.id, day: dayNum - 1, ai_meta: null },
          profile: null,
          actionType: "mission_checkin",
          userInput: btn.dataset.result
        });

        card.classList.add("hidden");
      };

  });

  if (skipBtn) skipBtn.onclick = () => card.classList.add("hidden");
}

/* ==========================================
   INIT
========================================== */
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    alert("Tu sesión ha expirado. Vuelve a iniciar sesión.");
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
    const { course, lesson, progress, reflection, feedback } = await loadLessonData(user.id, courseId, dayNum);

    // render base
    renderLessonHeader(course, lesson, dayNum);
    renderLessonContent(lesson);

    // reflection autosave
    const reflectionInput = qs("#lessonReflectionInput");
    if (reflectionInput) {
      if (reflection?.content) reflectionInput.value = reflection.content;

      reflectionInput.addEventListener("blur", () => saveReflection(user.id, courseId, lesson));
      setInterval(() => saveReflection(user.id, courseId, lesson), 5000);
    }

    // feedback
    setupFeedbackStars();
    if (feedback) {
      const starsContainer = qs("#feedbackStars");
      const commentEl = qs("#feedbackComment");

      if (starsContainer && typeof feedback.rating === "number" && feedback.rating > 0) {
        starsContainer.dataset.selected = String(feedback.rating);
        Array.from(starsContainer.children).forEach((child) => {
          const val = Number(child.dataset.value);
          child.classList.toggle("selected", val <= feedback.rating);
        });
      }
      if (commentEl && feedback.comment) commentEl.value = feedback.comment;
    }

    // mindset ui (inline)
    initMindsetUI();

    // checkin
    await initMissionCheckin(user.id, courseId, dayNum);

    // coach card al inicio (persistente)
    await showCoachCardIfActive({
      userId: user.id,
      course,
      lesson,
      profile,
      actionType: "pre_lesson",
      userInput: ""
    });

    // chat
    initCoachChat({ course, lesson, profile });

    // navegación
    const prevBtn = qs("#prevLessonBtn");
    const nextBtn = qs("#nextLessonBtn");
    const totalDays = course.duration_days || 1;
    const completed = progress ? isTrue(progress.completed) : false;

    if (prevBtn) {
      if (dayNum > 1) prevBtn.onclick = () => (window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum - 1}`);
      else {
        prevBtn.disabled = true;
        prevBtn.style.opacity = "0.4";
      }
    }

    if (nextBtn) {
      if (dayNum < totalDays) {
        if (completed) nextBtn.onclick = () => (window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum + 1}`);
        else {
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

    // botón completar -> muestra mindset inline (sin modales)
    const completeBtn = qs("#completeLessonBtn");
    const mindsetInline = qs("#mindsetInline");
    const mindsetSaveBtn = qs("#mindsetSaveBtn");

    if (completed) {
      if (completeBtn) {
        completeBtn.outerHTML = `
          <button class="btn completed-badge" disabled>
            ✓ Lección ya completada
          </button>
        `;
      }
      // si ya completó, no forzamos mindset, pero si no existe, podría mostrarse igual si quieres (por ahora no)
    } else if (completeBtn) {
      completeBtn.onclick = async () => {
        // guardar inputs
        await saveReflection(user.id, courseId, lesson);
        await saveFeedback(user.id, courseId, lesson);

        // completar lección
        const ok = await completeLesson(user.id, course, lesson);
        if (!ok) return;

        // habilitar next
        if (nextBtn && dayNum < totalDays) {
          nextBtn.disabled = false;
          nextBtn.style.opacity = "1";
          nextBtn.textContent = "Siguiente lección →";
          nextBtn.onclick = () => (window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum + 1}`);
        }

        // si ya existe mindset, redirige; si no, mostrar mindset inline
        const alreadyLogged = await hasMindsetLogForLesson(user.id, courseId, lesson.id);
        if (alreadyLogged) {
          const redirectInfo = await computeNextDayForRedirect(user.id, course);

          // coach post (si activo)
          await showCoachCardIfActive({
            userId: user.id,
            course,
            lesson,
            profile,
            actionType: "post_lesson",
            userInput: (qs("#feedbackComment")?.value?.trim() || "") + " " + (qs("#lessonReflectionInput")?.value?.trim() || "")
          });

          redirectAfterLesson(course, lesson, redirectInfo);
          return;
        }

        if (mindsetInline) {
          mindsetInline.classList.remove("hidden");
          mindsetInline.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      };
    }

    // guardar mindset y continuar
    if (mindsetSaveBtn) {
      mindsetSaveBtn.onclick = async () => {
        const saved = await saveMindsetLog(user.id, courseId, lesson);
        if (!saved) {
          alert("No se pudo guardar el mindset. Intenta nuevamente.");
          return;
        }

        // coach post (si activo) después de mindset
        await showCoachCardIfActive({
          userId: user.id,
          course,
          lesson,
          profile,
          actionType: "post_mindset",
          userInput: safeJson({
            reflection: qs("#lessonReflectionInput")?.value?.trim() || "",
            feedback: qs("#feedbackComment")?.value?.trim() || "",
            mood: qs("#mindsetMoodRow")?.dataset?.selected || null
          })
        });

        const redirectInfo = await computeNextDayForRedirect(user.id, course);
        redirectAfterLesson(course, lesson, redirectInfo);
      };
    }

  } catch (e) {
    console.error("[lesson] ERROR en init:", e);
    alert(e.message || "No se pudo cargar la lección.");
    window.location.href = "/dashboard/index.html";
  }
}

init();

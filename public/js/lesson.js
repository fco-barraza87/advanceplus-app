// /js/lesson.js
import { supabase } from "/js/supabase.js";

const qs = (s) => document.querySelector(s);

function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

/* ==========================================
   Helpers
========================================== */
function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/* ==========================================
   Load: course + lesson + progress + reflection + feedback
========================================== */
async function loadLessonData(userId, courseId, day) {
  const dayNum = Number(day) || 1;
  console.log("[lesson] loadLessonData →", { userId, courseId, dayNum });

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

    if (rErr) console.warn("[lesson] Error cargando reflexión (no crítico):", rErr);
    reflection = refData || null;
  } catch (e) {
    console.warn("[lesson] No se pudo cargar reflexión (tabla opcional):", e);
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

    if (fbErr) console.warn("[lesson] Error cargando feedback (no crítico):", fbErr);
    feedback = fbData || null;
  } catch (e) {
    console.warn("[lesson] No se pudo cargar feedback (tabla opcional):", e);
  }

  return { course, lesson, progress, reflection, feedback };
}

/* ==========================================
   Reflection: upsert seguro
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

/* ==========================================
   Render
========================================== */
function renderLessonHeader(course, lesson, day) {
  const backBtn = qs("#lessonBackBtn");
  const courseLabel = qs("#lessonCourseLabel");
  const titleEl = qs("#lessonTitle");
  const subtitleEl = qs("#lessonSubtitle");
  const metaEl = qs("#lessonMeta");

  if (backBtn) {
    backBtn.onclick = () => (window.location.href = `/curso/index.html?c=${course.id}`);
  }

  if (courseLabel) courseLabel.textContent = `${course.category || "Reto"} · ${course.title}`;
  if (titleEl) titleEl.textContent = lesson.title || `Día ${day}`;
  if (subtitleEl) subtitleEl.textContent = lesson.subtitle || "";

  if (metaEl) {
    metaEl.textContent = `Día ${day} · ${lesson.duration || 10} min · XP ${lesson.xp_reward || 25}`;
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
   Feedback stars
========================================== */
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
    const { data: existing, error: selErr } = await supabase
      .from("lesson_feedback")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (selErr) console.warn("[lesson] Error comprobando feedback existente:", selErr);

    if (existing?.id) {
      await supabase
        .from("lesson_feedback")
        .update({ rating: rating || null, comment: comment || null })
        .eq("id", existing.id);
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
  } catch (e) {
    console.warn("[lesson] No se pudo guardar feedback:", e);
  }
}

/* ==========================================
   Complete lesson (RPC)
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

  console.log("✅ finish_lesson ok:", data);
  return true;
}

async function computeNextDayForRedirect(userId, course) {
  const { data: allProgress, error } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .order("day", { ascending: true });

  if (error) console.warn("[lesson] Error leyendo progress:", error);

  const totalDays = course.duration_days || 1;
  const completedDays = (allProgress || []).filter((p) => !!p.completed);
  const lastCompleted = completedDays.length ? completedDays[completedDays.length - 1].day : 0;

  let nextDay = lastCompleted + 1;
  if (nextDay > totalDays) nextDay = totalDays;

  const finished = completedDays.length >= totalDays;
  return { nextDay, totalDays, finished };
}

/* ==========================================
   Confetti / glow
========================================== */
function launchConfetti() {
  const num = 22;
  for (let i = 0; i < num; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${50 + (Math.random() * 40 - 20)}%`;
    piece.style.setProperty("--x-move", `${Math.random() * 120 - 60}px`);
    const colors = ["#C9A86A", "#E9D2A6", "#F1E5C9", "#fff"];
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2600);
  }
}

function highlightLesson() {
  const section = document.querySelector(".lesson-content-section");
  if (!section) return;
  section.classList.add("lesson-glow");
  setTimeout(() => section.classList.remove("lesson-glow"), 1600);
}

/* ==========================================
   Mindset modal
========================================== */
let pendingRedirect = null;

function openMindsetModal() {
  const modal = qs("#mindsetModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  goToMindsetStep(1);
}

function closeMindsetModal() {
  const modal = qs("#mindsetModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function goToMindsetStep(step) {
  const step1 = qs("#mindsetStep1");
  const step2 = qs("#mindsetStep2");
  if (!step1 || !step2) return;

  if (step === 1) {
    step1.classList.remove("hidden");
    step2.classList.add("hidden");
  } else {
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
  }
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

    if (error) {
      console.warn("[lesson] Error comprobando mindset_logs:", error);
      return false;
    }
    return !!data;
  } catch (e) {
    console.warn("[lesson] hasMindsetLog exception:", e);
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

  const notes = best || challenge || decision ? JSON.stringify({ best, challenge, decision }) : null;

  try {
    await supabase.from("mindset_logs").insert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lesson.id,
      day: lesson.day,
      mood: moodValue,
      enfoque,
      energia,
      motivacion,
      claridad,
      confianza,
      notes
    });
  } catch (e) {
    console.warn("[lesson] No se pudo guardar mindset_logs:", e);
  }
}

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

function redirectAfterLesson(course, lesson, redirectInfo) {
  const { nextDay, totalDays, finished } = redirectInfo;
  if (finished && lesson.day >= totalDays) {
    window.location.href = `/curso/index.html?c=${course.id}`;
  } else {
    window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
  }
}

function redirectFromMindset() {
  if (!pendingRedirect) return;
  const { course, lesson, redirectInfo } = pendingRedirect;
  pendingRedirect = null;
  redirectAfterLesson(course, lesson, redirectInfo);
}

/* ==================================================
   Coach IA (definitivo v1.0)
   Regla: SOLO coach-card post_lesson y ANTES mindset
================================================== */
let cachedHasCoach = null;

async function hasActiveCoach(courseId) {
  if (cachedHasCoach !== null) return cachedHasCoach;

  try {
    const user = (await supabase.auth.getUser())?.data?.user;
    if (!user) return (cachedHasCoach = false);

    const { data, error } = await supabase.rpc("has_active_coach", {
      p_user: user.id,
      p_course: courseId
    });

    if (error) {
      console.warn("[coach] has_active_coach error:", error);
      return (cachedHasCoach = false);
    }

    cachedHasCoach = data === true;
    return cachedHasCoach;
  } catch (e) {
    console.warn("[coach] hasActiveCoach exception:", e);
    return (cachedHasCoach = false);
  }
}

async function callCoachEngine({ courseId, lessonId, day, actionType, intent, userInput }) {
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
        body: JSON.stringify({
          course_id: courseId,
          lesson_id: lessonId,
          day,
          action_type: actionType,
          intent: intent || "coach_card",
          user_input: userInput || null
        })
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

function showCoachCard(blocks, onContinue) {
  const card = qs("#coachCard");
  const content = qs("#coachCardContent");
  if (!card || !content) return;

  content.innerHTML = "";

  (blocks || []).forEach((b) => {
    const div = document.createElement("div");
    div.className = `coach-block coach-${b.type || "text"}`;

    if (b.title) {
      const h4 = document.createElement("h4");
      h4.textContent = b.title;
      div.appendChild(h4);
    }

    const p = document.createElement("p");
    p.textContent = b.text || "";
    div.appendChild(p);

    content.appendChild(div);
  });

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Continuar";
  btn.onclick = () => {
    card.classList.add("hidden");
    if (typeof onContinue === "function") onContinue();
  };

  content.appendChild(btn);
  card.classList.remove("hidden");
}

/* ==================================================
   Micro-chequeo (anti-409)
   - si insert da 409/23505, se ignora y se oculta igual
================================================== */
async function initMissionCheckin(userId, courseId, dayNum) {
  if (dayNum <= 1) return;

  const card = qs("#missionCheckinCard");
  if (!card) return;

  const { data: prevLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", dayNum - 1)
    .maybeSingle();

  if (!prevLesson?.id) return;

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

  async function saveResult(result) {
    const payload = {
      user_id: userId,
      course_id: courseId,
      lesson_id: prevLesson.id,
      day: dayNum - 1,
      result,
      note: noteInput?.value?.trim() || null
    };

    const { error } = await supabase.from("mission_checkins").insert(payload);

    // Si hay conflicto por duplicado, lo ignoramos
    if (error) {
      const code = error.code || "";
      const msg = (error.message || "").toLowerCase();
      const isConflict = code === "23505" || msg.includes("duplicate") || msg.includes("conflict");
      if (!isConflict) console.warn("[mission_checkins] insert error:", error);
    }

    card.classList.add("hidden");
  }

  card.querySelectorAll("button[data-result]").forEach((btn) => {
    btn.onclick = () => saveResult(btn.dataset.result);
  });

  if (skipBtn) skipBtn.onclick = () => card.classList.add("hidden");
}

/* ==================================================
   Coach Chat (drawer) — opcional
   - usa coach-engine intent="chat"
================================================== */
function initCoachChatUI({ courseId, lessonId, day }) {
  const fab = qs("#coachFab");
  const drawer = qs("#coachChatDrawer");
  const closeBtn = qs("#coachChatClose");
  const messages = qs("#coachChatMessages");
  const input = qs("#coachChatInput");
  const sendBtn = qs("#coachChatSend");

  if (!fab || !drawer || !closeBtn || !messages || !input || !sendBtn) return;

  const addMsg = (who, text) => {
    const div = document.createElement("div");
    div.style.padding = "10px 12px";
    div.style.borderRadius = "12px";
    div.style.marginBottom = "10px";
    div.style.maxWidth = "92%";
    div.style.whiteSpace = "pre-wrap";

    if (who === "user") {
      div.style.marginLeft = "auto";
      div.style.background = "rgba(255,255,255,0.14)";
      div.textContent = text;
    } else {
      div.style.marginRight = "auto";
      div.style.background = "rgba(192,164,80,0.18)";
      div.textContent = text;
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  };

  fab.onclick = () => {
    drawer.classList.remove("hidden");
    if (!messages.hasChildNodes()) {
      addMsg("coach", "Estoy aquí contigo. ¿Qué necesitas destrabar hoy?");
    }
    setTimeout(() => input.focus(), 50);
  };

  closeBtn.onclick = () => drawer.classList.add("hidden");

  async function send() {
    const text = input.value.trim();
    if (!text) return;

    addMsg("user", text);
    input.value = "";

    const resp = await callCoachEngine({
      courseId,
      lessonId,
      day,
      actionType: "chat",
      intent: "chat",
      userInput: text
    });

    // Respuesta robusta (no asumimos formato)
    if (resp?.reply && typeof resp.reply === "string") {
      addMsg("coach", resp.reply);
      return;
    }

    if (Array.isArray(resp?.blocks) && resp.blocks.length) {
      const joined = resp.blocks.map(b => b.text).filter(Boolean).join("\n\n");
      addMsg("coach", joined || "Ok. Te leo. ¿Qué parte te cuesta más?");
      return;
    }

    addMsg("coach", "Te leo. Dame 1 frase: ¿qué quieres lograr mañana exactamente?");
  }

  sendBtn.onclick = send;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  return { showFab: () => fab.classList.remove("hidden") };
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
  const dayParam = getQueryParam("day") || "1";
  const dayNum = Number(dayParam) || 1;

  if (!courseId) {
    alert("No se ha especificado el curso.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  try {
    const { course, lesson, progress, reflection, feedback } = await loadLessonData(
      user.id,
      courseId,
      dayNum
    );

    // Normaliza completed por si viene raro
    if (progress && typeof progress.completed === "string") {
      progress.completed = progress.completed === "t" || progress.completed === "true";
    }
    if (progress && typeof progress.completed === "number") {
      progress.completed = progress.completed === 1;
    }

    renderLessonHeader(course, lesson, dayNum);
    renderLessonContent(lesson);
    setupFeedbackStars();
    initMindsetUI();

    // Reflection autosave
    const reflectionInput = qs("#lessonReflectionInput");
    if (reflectionInput) {
      if (reflection?.content) reflectionInput.value = reflection.content;

      reflectionInput.addEventListener("blur", () => saveReflection(user.id, courseId, lesson));
      setInterval(() => saveReflection(user.id, courseId, lesson), 5000);
    }

    // Restore feedback
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

    // Micro-checkin
    await initMissionCheckin(user.id, courseId, dayNum);

    // Coach Chat FAB (solo si tiene coach activo)
    const hasCoach = await hasActiveCoach(course.id);
    const chatUI = initCoachChatUI({ courseId: course.id, lessonId: lesson.id, day: lesson.day });
    if (hasCoach && chatUI?.showFab) chatUI.showFab();

    // Botón completar
    const completeBtn = qs("#completeLessonBtn");
    const isCompleted =
      progress && (progress.completed === true || progress.completed === "t" || progress.completed === 1);

    if (isCompleted) {
      if (completeBtn) {
        completeBtn.outerHTML = `
          <button class="btn completed-badge" disabled>
            ✓ Lección ya completada
          </button>
        `;
      }
    } else {
      if (completeBtn) {
        completeBtn.onclick = async () => {
          await saveReflection(user.id, courseId, lesson);

          const ok = await completeLesson(user.id, course, lesson);
          if (!ok) return;

          await saveFeedback(user.id, courseId, lesson);

          launchConfetti();
          highlightLesson();

          const redirectInfo = await computeNextDayForRedirect(user.id, course);

          // Lo que viene después del coach-card (SIEMPRE mindset antes de redirect, salvo ya exista mindset)
          const goNext = async () => {
            const alreadyLogged = await hasMindsetLogForLesson(user.id, courseId, lesson.id);
            if (alreadyLogged) {
              redirectAfterLesson(course, lesson, redirectInfo);
            } else {
              pendingRedirect = { course, lesson, redirectInfo };
              openMindsetModal();
            }
          };

          // === REGLA OFICIAL: Coach Card antes del Mindset ===
          if (hasCoach) {
            const userInput =
              (qs("#feedbackComment")?.value?.trim() || "") +
              "\n" +
              (qs("#lessonReflectionInput")?.value?.trim() || "");

            const coachResp = await callCoachEngine({
              courseId: course.id,
              lessonId: lesson.id,
              day: lesson.day,
              actionType: "post_lesson",
              intent: "coach_card",
              userInput
            });

            if (coachResp?.blocks?.length) {
              showCoachCard(coachResp.blocks, goNext);
              return; // se continúa SOLO al apretar "Continuar"
            }
          }

          // Si no hay coach o no devolvió blocks, seguimos normal
          await goNext();
        };
      }
    }

    // Navegación prev/next
    const prevBtn = qs("#prevLessonBtn");
    const nextBtn = qs("#nextLessonBtn");
    const totalDays = course.duration_days || 1;

    if (prevBtn) {
      if (dayNum > 1) {
        prevBtn.onclick = () => {
          window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum - 1}`;
        };
      } else {
        prevBtn.disabled = true;
        prevBtn.style.opacity = "0.4";
      }
    }

    if (nextBtn) {
      if (dayNum < totalDays) {
        if (isCompleted) {
          nextBtn.onclick = () => {
            window.location.href = `/curso/lesson.html?c=${courseId}&day=${dayNum + 1}`;
          };
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

    // Eventos Mindset modal
    const btnMindsetNext = qs("#mindsetNextStep");
    const btnMindsetBack = qs("#mindsetBackStep");
    const btnMindsetSkip1 = qs("#mindsetSkipStep1");
    const btnMindsetSave = qs("#mindsetSaveBtn");
    const btnMindsetCloseX = qs("#mindsetCloseX");

    if (btnMindsetNext) btnMindsetNext.onclick = () => goToMindsetStep(2);
    if (btnMindsetBack) btnMindsetBack.onclick = () => goToMindsetStep(1);

    async function skipMindsetAndGo() {
      closeMindsetModal();
      redirectFromMindset();
    }

    if (btnMindsetSkip1) btnMindsetSkip1.onclick = skipMindsetAndGo;
    if (btnMindsetCloseX) btnMindsetCloseX.onclick = skipMindsetAndGo;

    if (btnMindsetSave) {
      btnMindsetSave.onclick = async () => {
        await saveMindsetLog(user.id, courseId, lesson);
        closeMindsetModal();
        redirectFromMindset();
      };
    }

  } catch (e) {
    console.error("[lesson] ERROR en init:", e);
    alert(e.message || "No se pudo cargar la lección (error desconocido).");
    window.location.href = "/dashboard/index.html";
  }
}

init();

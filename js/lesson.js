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
  console.log("[lesson] loadLessonData →", { userId, courseId, dayNum });

  /* ---------- CURSO ---------- */
  const { data: course, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  console.log("[lesson] course result:", { course, cErr });

  if (cErr) {
    throw new Error("Error cargando curso: " + cErr.message);
  }
  if (!course) {
    throw new Error("Curso no encontrado para ese id.");
  }

  /* ---------- LECCIÓN ---------- */
  const { data: lesson, error: lErr } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  console.log("[lesson] lesson result:", { lesson, lErr });

  if (lErr) {
    throw new Error("Error cargando lección: " + lErr.message);
  }
  if (!lesson) {
    throw new Error(`No existe lección para el día ${dayNum} en este curso.`);
  }

  /* ---------- PROGRESO ---------- */
  const { data: progress, error: pErr } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", dayNum)
    .maybeSingle();

  console.log("[lesson] progress result:", { progress, pErr });

  if (pErr) {
    console.warn("[lesson] Error cargando progreso (no crítico):", pErr);
  }

  /* ---------- REFLEXIÓN (opcional, robusto) ---------- */
  let reflection = null;
  try {
    const { data: refData, error: rErr } = await supabase
      .from("lesson_reflections")
      .select("id, content")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (rErr) {
      console.warn("[lesson] Error cargando reflexión (no crítico):", rErr);
    }

    reflection = refData || null;
    console.log("[lesson] reflection result:", { reflection });
  } catch (e) {
    console.warn("[lesson] No se pudo cargar reflexión (tabla opcional):", e);
  }

  /* ---------- FEEDBACK (rating + comment) ---------- */
  let feedback = null;
  try {
    const { data: fbData, error: fbErr } = await supabase
      .from("lesson_feedback")
      .select("id, rating, comment")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (fbErr) {
      console.warn("[lesson] Error cargando feedback (no crítico):", fbErr);
    }

    feedback = fbData || null;
    console.log("[lesson] feedback result:", { feedback });
  } catch (e) {
    console.warn("[lesson] No se pudo cargar feedback (tabla opcional):", e);
  }

  return { course, lesson, progress, reflection, feedback };
}


/* ==========================================
   Guardar reflexión (upsert real y seguro)
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
  } catch (e) {
    console.error("❌ Error guardando reflexión:", e);
  }
}

/* ==========================================
   4. Render lección
========================================== */
function renderLessonHeader(course, lesson, day) {
  const backBtn = qs("#lessonBackBtn");
  const courseLabel = qs("#lessonCourseLabel");
  const titleEl = qs("#lessonTitle");
  const subtitleEl = qs("#lessonSubtitle");
  const metaEl = qs("#lessonMeta");

  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = `/curso/index.html?c=${course.id}`;
    };
  }

  if (courseLabel)
    courseLabel.textContent = `${course.category || "Reto"} · ${course.title}`;

  if (titleEl) titleEl.textContent = lesson.title || `Día ${day}`;
  if (subtitleEl) subtitleEl.textContent = lesson.subtitle || "";

  if (metaEl) {
    metaEl.textContent = `Día ${day} · ${lesson.duration || 10} min · XP ${
      lesson.xp_reward || 25
    }`;
  }
}

function renderLessonContent(lesson) {
  const contentEl = qs("#lessonContent");
  const mediaEl = qs("#lessonMedia");
  const exerciseTextEl = qs("#lessonExerciseText");

  if (contentEl) {
    if (lesson.content_html) {
      contentEl.innerHTML = lesson.content_html;
    } else if (lesson.text_content) {
      contentEl.innerHTML = lesson.text_content;
    } else {
      contentEl.textContent =
        "Muy pronto verás aquí el contenido completo de esta lección.";
    }
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
   5. Feedback (estrellas inline)
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
        if (Number(child.dataset.value) <= value) {
          child.classList.add("selected");
        } else {
          child.classList.remove("selected");
        }
      });
    };

    container.appendChild(star);
  }
}

/* ==========================================
   6. Guardar feedback
========================================== */
async function saveFeedback(userId, courseId, lesson) {
  const starsContainer = qs("#feedbackStars");
  const commentEl = qs("#feedbackComment");

  if (!starsContainer) return;

  const rating = Number(starsContainer.dataset.selected || 0);
  const comment = commentEl ? commentEl.value.trim() : "";

  // Si el usuario no puso nada, no guardamos nada nuevo
  // (OJO: esto no borra el feedback anterior, solo evita sobreescribir con vacío)
  if (!rating && !comment) {
    return;
  }

  try {
    // ¿Ya existe feedback para este user/curso/lección?
    const { data: existing, error: selErr } = await supabase
      .from("lesson_feedback")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (selErr) {
      console.warn("[lesson] Error comprobando feedback existente:", selErr);
    }

    if (existing?.id) {
      // UPDATE si ya existe fila
      await supabase
        .from("lesson_feedback")
        .update({
          rating: rating || null,
          comment: comment || null
        })
        .eq("id", existing.id);
    } else {
      // INSERT si no existe
      await supabase.from("lesson_feedback").insert({
        user_id: userId,
        course_id: courseId,
        lesson_id: lesson.id,
        day: lesson.day,
        rating: rating || null,
        comment: comment || null
      });
    }

    console.log("[lesson] feedback guardado / actualizado");
  } catch (e) {
    console.warn("[lesson] No se pudo guardar feedback:", e);
  }
}


/* ==========================================
   7. Completar lección
========================================== */
async function completeLesson(userId, course, lesson) {
  try {
    await supabase
      .from("progress")
      .update({
        completed: true,
        xp: lesson.xp_reward || 0
      })
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("day", lesson.day);

    console.log("[lesson] progress actualizado");
  } catch (e) {
    console.error("[lesson] Error al actualizar progress:", e);
  }
}

/* ==========================================
   8. Calcular nextDay para redirección
========================================== */
async function computeNextDayForRedirect(userId, course, currentDay) {
  const { data: allProgress, error } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .order("day", { ascending: true });

  if (error) {
    console.warn("[lesson] Error leyendo progress para nextDay:", error);
  }

  const totalDays = course.duration_days || 1;

  const completedDays = (allProgress || []).filter((p) => p.completed);
  const lastCompleted = completedDays.length
    ? completedDays[completedDays.length - 1].day
    : 0;

  let nextDay = lastCompleted + 1;
  if (nextDay > totalDays) nextDay = totalDays;

  const finished = completedDays.length >= totalDays;

  return { nextDay, totalDays, finished };
}

/* ==========================================
   CONFETTI PREMIUM A+
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
   MINDSET LOGS
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
    console.warn("[lesson] Error inesperado en hasMindsetLogForLesson:", e);
    return false;
  }
}


async function saveMindsetLog(userId, courseId, lesson) {
  const moodRow = qs("#mindsetMoodRow");
  const moodValue = moodRow?.dataset.selected
    ? Number(moodRow.dataset.selected)
    : null;

  const enfoque = Number(qs("#mindsetFocus")?.value || null);
  const energia = Number(qs("#mindsetEnergy")?.value || null);
  const motivacion = Number(qs("#mindsetMotivation")?.value || null);
  const claridad = Number(qs("#mindsetClarity")?.value || null);
  const confianza = Number(qs("#mindsetConfidence")?.value || null);


  const best = qs("#mindsetNoteBest")?.value.trim() || "";
  const challenge = qs("#mindsetNoteChallenge")?.value.trim() || "";
  const decision = qs("#mindsetNoteDecision")?.value.trim() || "";

  const notes =
    best || challenge || decision
      ? JSON.stringify({ best, challenge, decision })
      : null;

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

    console.log("[lesson] mindset_log guardado");
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
        const val = btn.dataset.value;
        moodRow.dataset.selected = val;
        Array.from(moodRow.children).forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
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

    const update = () => {
      label.textContent = `${input.value} / 5`;
    };

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
  redirectAfterLesson(course, lesson, redirectInfo);
  pendingRedirect = null;
}

/* ==========================================
   9. INIT
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

  console.log("[lesson] init →", { courseId, dayParam, dayNum });

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

    if (progress && typeof progress.completed === "string") {
      progress.completed = progress.completed === "t" || progress.completed === "true";
    }


    /* ============================
       Cargar reflexión previa
    ============================ */
    const reflectionInput = qs("#lessonReflectionInput");

    if (reflectionInput) {
      if (reflection?.content) {
        reflectionInput.value = reflection.content;
      }

      reflectionInput.addEventListener("blur", () => {
        saveReflection(user.id, courseId, lesson);
      });

      setInterval(() => {
        saveReflection(user.id, courseId, lesson);
      }, 5000);
    }

    renderLessonHeader(course, lesson, dayNum);
    renderLessonContent(lesson);
    setupFeedbackStars();
    initMindsetUI();

    /* ============================
    Cargar feedback previo
    ============================ */
    if (feedback) {
      const starsContainer = qs("#feedbackStars");
      const commentEl = qs("#feedbackComment");

      // Restaurar rating
      if (starsContainer && typeof feedback.rating === "number" && feedback.rating > 0) {
        starsContainer.dataset.selected = String(feedback.rating);

        Array.from(starsContainer.children).forEach((child) => {
          const val = Number(child.dataset.value);
          if (val <= feedback.rating) {
            child.classList.add("selected");
          } else {
            child.classList.remove("selected");
          }
        });
      }

      // Restaurar comentario
      if (commentEl && feedback.comment) {
        commentEl.value = feedback.comment;
      }
    }


    /* ============================
       Botón completar lección
    ============================ */
    const completeBtn = qs("#completeLessonBtn");
    const isCompleted = progress && (progress.completed === true || progress.completed === 't' || progress.completed === 1);

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
          // 1. Guardar reflexión
          await saveReflection(user.id, courseId, lesson);

          // 2. Marcar progreso
          await completeLesson(user.id, course, lesson);

          // 3. Guardar feedback si existe
          await saveFeedback(user.id, courseId, lesson);

          // 4. Animación A+
          launchConfetti();
          highlightLesson();

          // 5. Lógica de redirección + mindset
          const redirectInfo = await computeNextDayForRedirect(
            user.id,
            course,
            lesson.day
          );

          const alreadyLogged = await hasMindsetLogForLesson(
            user.id,
            courseId,
            lesson.id
          );

          if (alreadyLogged) {
            redirectAfterLesson(course, lesson, redirectInfo);
          } else {
            pendingRedirect = { course, lesson, redirectInfo };
            openMindsetModal();
          }

        };
      }
    }

    /* ============================================
       Navegación: Siguiente / Anterior lección
    ============================================ */
    const prevBtn = qs("#prevLessonBtn");
    const nextBtn = qs("#nextLessonBtn");
    const totalDays = course.duration_days || 1;

    // Anterior
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

    // Siguiente
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

    /* ============================================
       Eventos del modal de mindset
    ============================================ */
    const btnMindsetNext = qs("#mindsetNextStep");
    const btnMindsetBack = qs("#mindsetBackStep");
    const btnMindsetSkip1 = qs("#mindsetSkipStep1");
    const btnMindsetSave = qs("#mindsetSaveBtn");
    const btnMindsetCloseX = qs("#mindsetCloseX");

    if (btnMindsetNext) {
      btnMindsetNext.onclick = () => {
        goToMindsetStep(2);
      };
    }

    if (btnMindsetBack) {
      btnMindsetBack.onclick = () => {
        goToMindsetStep(1);
      };
    }

    async function skipMindsetAndGo() {
      closeMindsetModal();
      redirectFromMindset();
    }

    if (btnMindsetSkip1) {
      btnMindsetSkip1.onclick = skipMindsetAndGo;
    }

    if (btnMindsetCloseX) {
      btnMindsetCloseX.onclick = skipMindsetAndGo;
    }

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

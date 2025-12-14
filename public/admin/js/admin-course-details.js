// /admin/js/admin-course-details.js
import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

let courseId = null;
let courseLessonsCache = [];

// ================================
// FEEDBACK PAGINATION
// ================================
let feedbackOffset = 0;
const FEEDBACK_LIMIT = 30;
let feedbackHasMore = true;

// Helpers DOM
const $ = (id) => document.getElementById(id);

// =======================================================
// INIT
// =======================================================
document.addEventListener("DOMContentLoaded", init);

async function init() {
  await requireAdmin();

  courseId = new URLSearchParams(window.location.search).get("id");

  setupSidebarToggle();
  setupTabs();
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  if (urlTab) {
    document.querySelector(`.tab-button[data-tab="${urlTab}"]`)?.click();
  }

  setupActions();

  if (courseId) {
    await loadCourse(courseId);
    await loadCourseLessons();
    await loadCourseUsers();
    await loadCourseFeedback();
    await populateFeedbackLessonFilter();

  } else {
    setupNewCourseMode();
  }
}

// =======================================================
// SIDEBAR
// =======================================================
function setupSidebarToggle() {
  $("sidebarToggle")?.addEventListener("click", () => {
    document.querySelector(".admin-sidebar")?.classList.toggle("sidebar-closed");
    document.querySelector(".admin-header-bar")?.classList.toggle("header-shifted");
  });
}

// =======================================================
// TABS
// =======================================================
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      tabs.forEach(b => b.classList.remove("tab-button-active"));
      btn.classList.add("tab-button-active");

      panels.forEach(p => {
        p.classList.toggle("tab-panel-active", p.id === `tab-${target}`);
      });
    });
  });
}

// =======================================================
// LOAD COURSE
// =======================================================
async function loadCourse(id) {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    alert("No se pudo cargar el curso");
    return;
  }

  $("pageCourseTitle").textContent = data.title || "Curso";
  $("breadcrumbCourseTitle").textContent = data.title || "Curso";

  $("inputTitle").value = data.title ?? "";
  $("inputSubtitle").value = data.subtitle ?? "";
  $("inputSlug").value = data.slug ?? "";
  $("inputCategory").value = data.category ?? "";
  $("selectVisibility").value = data.visibility ?? "public";
  $("selectProgression").value = data.progression_type ?? "free";
  $("inputDurationDays").value = data.duration_days ?? "";
  $("inputLevel").value = data.level ?? "";
  $("inputXpReward").value = data.xp_reward ?? "";
  $("inputTags").value = Array.isArray(data.tags) ? data.tags.join(", ") : "";

  $("textareaDescription").value = data.description ?? "";
  $("inputCoverUrl").value = data.cover_url ?? "";
  $("inputIntroAudioUrl").value = data.intro_audio_url ?? "";
  $("inputIntroVideoUrl").value = data.intro_video_url ?? "";
  $("inputSystemeUrl").value = data.systeme_checkout_url ?? "";

  $("checkboxIsPaid").checked = !!data.is_paid;
  $("checkboxActive").checked = data.active !== false;
}

// =======================================================
// NUEVO CURSO
// =======================================================
function setupNewCourseMode() {
  $("pageCourseTitle").textContent = "Nuevo curso";
  $("breadcrumbCourseTitle").textContent = "Nuevo curso";
  $("btnSoftDelete")?.remove();
}

// =======================================================
// ACTIONS
// =======================================================
function setupActions() {
  $("btnSaveCourse")?.addEventListener("click", onSaveCourse);
  $("btnSoftDelete")?.addEventListener("click", onSoftDelete);

  $("btnNewLesson")?.addEventListener("click", () => {
    if (!courseId) {
      alert("Guarda el curso primero");
      return;
    }
    window.location.href =
      `/admin/lesson-details.html?course_id=${courseId}`;
  });
}

// =======================================================
// SAVE COURSE
// =======================================================
async function onSaveCourse() {
  const payload = collectPayload();
  if (!validateRequired(payload)) return;

  if (courseId) {
    await supabase.from("courses").update(payload).eq("id", courseId);
    alert("Curso actualizado");
  } else {
    const { data } = await supabase
      .from("courses")
      .insert(payload)
      .select("id")
      .single();

    window.location.href =
      `/admin/course-details.html?id=${data.id}`;
  }
}

// =======================================================
// SOFT DELETE
// =======================================================
async function onSoftDelete() {
  if (!confirm("¿Desactivar este curso?")) return;
  await supabase.from("courses").update({ active: false }).eq("id", courseId);
  $("checkboxActive").checked = false;
}

// =======================================================
// PAYLOAD
// =======================================================
function collectPayload() {
  return {
    title: $("inputTitle").value.trim() || null,
    subtitle: $("inputSubtitle").value.trim() || null,
    slug: $("inputSlug").value.trim() || null,
    description: $("textareaDescription").value.trim() || null,
    category: $("inputCategory").value.trim() || null,
    visibility: $("selectVisibility").value,
    progression_type: $("selectProgression").value,
    duration_days: Number($("inputDurationDays").value) || null,
    level: Number($("inputLevel").value) || null,
    xp_reward: Number($("inputXpReward").value) || null,
    tags: $("inputTags").value
      ? $("inputTags").value.split(",").map(t => t.trim())
      : null,
    is_paid: $("checkboxIsPaid").checked,
    active: $("checkboxActive").checked,
    cover_url: $("inputCoverUrl").value || null,
    intro_audio_url: $("inputIntroAudioUrl").value || null,
    intro_video_url: $("inputIntroVideoUrl").value || null,
    systeme_checkout_url: $("inputSystemeUrl").value || null
  };
}

function validateRequired(p) {
  if (!p.title || !p.slug || !p.category || !p.duration_days || !p.level) {
    alert("Faltan campos obligatorios");
    return false;
  }
  return true;
}

// =======================================================
// LECCIONES DEL CURSO (LIST + REORDER)
// =======================================================
const lessonsTbody = $("courseLessonsBody");

async function loadCourseLessons() {
  const { data } = await supabase
    .from("lessons")
    .select("id, day, title, xp_reward, is_checkpoint")
    .eq("course_id", courseId)
    .eq("is_deleted", false)
    .order("day", { ascending: true });

  courseLessonsCache = data || [];
  renderLessons();
}

function renderLessons() {
  lessonsTbody.innerHTML = "";

  courseLessonsCache.forEach((l, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>Día ${l.day}</td>
      <td>${l.title ?? "(Sin título)"}</td>
      <td>${l.xp_reward ?? 0}</td>
      <td>${l.is_checkpoint ? "✔" : "—"}</td>
      <td>
        <button data-action="up" data-id="${l.id}" ${i === 0 ? "disabled" : ""}>↑</button>
        <button data-action="down" data-id="${l.id}" ${i === courseLessonsCache.length - 1 ? "disabled" : ""}>↓</button>
        <button data-action="edit" data-id="${l.id}">Editar</button>
        <button data-action="duplicate" data-id="${l.id}">Duplicar</button>
        <button
          class="btn-small btn-outline-danger"
          data-action="delete"
          data-id="${l.id}">
          Eliminar
        </button>
      </td>`;
    lessonsTbody.appendChild(tr);
  });
}

lessonsTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "edit") {
    window.location.href = `/admin/lesson-details.html?id=${id}`;
  }

  if (action === "duplicate") {
    window.location.href =
      `/admin/lesson-details.html?duplicate=${id}&course_id=${courseId}`;
  }

  if (action === "up" || action === "down") {
    await moveLesson(id, action);
  }

  if (action === "delete") {
    const ok = confirm(
      "¿Eliminar esta lección?\nNo se borrará definitivamente."
    );
    if (!ok) return;

    await softDeleteLesson(id);
  }

});


async function softDeleteLesson(lessonId) {
  const { error } = await supabase
    .from("lessons")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString()
    })
    .eq("id", lessonId);

  if (error) {
    console.error("Error eliminando lección:", error);
    alert("No se pudo eliminar la lección");
    return;
  }

  await loadCourseLessons();
}

async function moveLesson(id, dir) {
  const i = courseLessonsCache.findIndex(l => l.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= courseLessonsCache.length) return;

  const a = courseLessonsCache[i];
  const b = courseLessonsCache[j];

  await supabase.from("lessons").update({ day: b.day }).eq("id", a.id);
  await supabase.from("lessons").update({ day: a.day }).eq("id", b.id);

  await loadCourseLessons();
}


const usersTbody = document.getElementById("courseUsersBody");
const btnEnrollUser = document.getElementById("btnEnrollUser");


async function loadCourseUsers() {
  if (!courseId || !usersTbody) return;

  // 1️⃣ Traer inscripciones
  const { data: enrollments, error } = await supabase
    .from("user_courses")
    .select("user_id, is_active, frozen_at, removed_at")
    .eq("course_id", courseId)
    .is("removed_at", null);

  if (error) {
    console.error("[admin] Error cargando inscritos", error);
    usersTbody.innerHTML =
      `<tr><td colspan="5">Error cargando usuarios</td></tr>`;
    return;
  }

  if (!enrollments.length) {
    renderCourseUsers([]);
    return;
  }

  // 2️⃣ Traer perfiles
  const userIds = enrollments.map(e => e.user_id);

  const { data: profiles, error: errProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);

  if (errProfiles) {
    console.error("[admin] Error cargando perfiles", errProfiles);
    return;
  }

  // 3️⃣ Crear mapa de perfiles (FALTABA ESTO)
  const profilesMap = Object.fromEntries(
    profiles.map(p => [p.id, p])
  );

  // 4️⃣ Traer progreso de TODOS los usuarios del curso
  const { data: progressRows, error: errProgress } = await supabase
    .from("progress")
    .select("user_id, completed")
    .eq("course_id", courseId);

  if (errProgress) {
    console.error("[admin] Error cargando progreso", errProgress);
  }

  // Agrupar progreso por usuario
  const progressByUser = {};
  (progressRows || []).forEach(p => {
    if (!progressByUser[p.user_id]) {
      progressByUser[p.user_id] = { total: 0, completed: 0 };
    }
    progressByUser[p.user_id].total++;
    if (p.completed) progressByUser[p.user_id].completed++;
  });

  // 5️⃣ Merge final (con progreso)
  const merged = enrollments.map(e => {
    const prog = progressByUser[e.user_id] || { total: 0, completed: 0 };
    return {
      ...e,
      profile: profilesMap[e.user_id] || null,
      progress: prog
    };
  });

  renderCourseUsers(merged);

}



function renderCourseUsers(list) {
  usersTbody.innerHTML = "";

  if (!list.length) {
    usersTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-placeholder">
          No hay usuarios inscritos en este curso.
        </td>
      </tr>`;
    return;
  }

  list.forEach(row => {
    const user = row.profile;
    if (!user) return;

    const status = row.frozen_at
      ? "Congelado"
      : row.is_active
      ? "Activo"
      : "Inactivo";

    // ✅ PROGRESO
    const total = row.progress?.total || 0;
    const done = row.progress?.completed || 0;

    let progressLabel = "—";
    if (total > 0) {
      const pct = Math.round((done / total) * 100);
      progressLabel =
        done >= total
          ? "Completado"
          : `${done} / ${total} (${pct}%)`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${user.full_name ?? "—"}</td>
      <td>${user.email ?? "—"}</td>
      <td>${status}</td>
      <td>${progressLabel}</td>
      <td class="table-actions">
        <button data-action="freeze" data-user="${row.user_id}">
          ${row.frozen_at ? "Descongelar" : "Congelar"}
        </button>
        <button data-action="reset" data-user="${row.user_id}">
          Reset progreso
        </button>
        <button data-action="remove" data-user="${row.user_id}">
          Quitar
        </button>
      </td>
    `;
    usersTbody.appendChild(tr);
  });
}


usersTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const userId = btn.dataset.user;
  const action = btn.dataset.action;

  if (!userId || !action) return;

  if (action === "freeze") {
    await supabase.rpc("freeze_user_course", {
      p_user: userId,
      p_course: courseId,
      p_freeze: btn.textContent === "Congelar"
    });
  }

  if (action === "reset") {
    const ok = confirm("¿Resetear progreso del usuario en este curso?");
    if (!ok) return;

    await supabase.rpc("reset_user_course_progress", {
      p_user: userId,
      p_course: courseId
    });
  }

  if (action === "remove") {
    const ok = confirm("¿Quitar usuario del curso?");
    if (!ok) return;

    await supabase.rpc("remove_user_from_course", {
      p_user: userId,
      p_course: courseId
    });
  }

  await loadCourseUsers();
});

btnEnrollUser?.addEventListener("click", async () => {
  const email = prompt("Email del usuario a inscribir:");
  if (!email) return;

  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) {
    alert("Usuario no encontrado");
    return;
  }

  await supabase.rpc("enroll_user_to_course", {
    p_user: user.id,
    p_course: courseId
  });

  await loadCourseUsers();
});


const feedbackTbody = document.getElementById("courseFeedbackBody");


async function loadCourseFeedback(reset = true) {
  if (!courseId || !feedbackTbody) return;

  if (reset) {
    feedbackOffset = 0;
    feedbackHasMore = true;
    feedbackTbody.innerHTML = "";
  }

  // 🎛️ Filtros UI
  const lessonId = document.getElementById("filterLesson")?.value || "";
  const rating = document.getElementById("filterRating")?.value || "";
  const commentFilter = document.getElementById("filterComment")?.value || "";

  // 🧠 Query base
  let query = supabase
    .from("lesson_feedback")
    .select(`
      id,
      day,
      rating,
      comment,
      created_at,
      user_id,
      lesson_id
    `)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .range(feedbackOffset, feedbackOffset + FEEDBACK_LIMIT - 1);

  // 🎯 Filtros reales
  if (lessonId) query = query.eq("lesson_id", lessonId);
  if (rating) query = query.eq("rating", Number(rating));
  if (commentFilter === "with") query = query.not("comment", "is", null);
  if (commentFilter === "without") query = query.is("comment", null);

  // 🚀 Fetch
  const { data: feedback, error } = await query;

  if (error) {
    console.error("[admin] Error cargando feedback", error);
    return;
  }

  // 📦 Control paginación
  if (feedback.length < FEEDBACK_LIMIT) {
    feedbackHasMore = false;
    document.getElementById("btnLoadMoreFeedback")?.classList.add("hidden");
  } else {
    document.getElementById("btnLoadMoreFeedback")?.classList.remove("hidden");
  }

  feedbackOffset += feedback.length;

  if (!feedback.length && reset) {
    renderCourseFeedback([]);
    return;
  }

  // 👤 Usuarios + lecciones
  const userIds = [...new Set(feedback.map(f => f.user_id))];
  const lessonIds = [...new Set(feedback.map(f => f.lesson_id))];

  const [{ data: profiles }, { data: lessons }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", userIds),
    supabase.from("lessons").select("id, title").in("id", lessonIds)
  ]);

  const profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));
  const lessonsMap = Object.fromEntries(lessons.map(l => [l.id, l]));

  const merged = feedback.map(fb => ({
    ...fb,
    profile: profilesMap[fb.user_id] || null,
    lesson: lessonsMap[fb.lesson_id] || null
  }));
  
  renderFeedbackKpis(merged);

  computeFeedbackInsights(merged);
  renderCourseFeedback(merged, !reset);
}

// =======================================================
// FEEDBACK FILTERS EVENTS
// =======================================================

document
  .getElementById("btnApplyFeedbackFilters")
  ?.addEventListener("click", () => {
    loadCourseFeedback();
  });

document
  .getElementById("btnLoadMoreFeedback")
  ?.addEventListener("click", () => {
    loadCourseFeedback(false);
  });


  // filterlessons
async function populateFeedbackLessonFilter() {
  const select = document.getElementById("filterLesson");
  if (!select || !courseId) return;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title")
    .eq("course_id", courseId)
    .eq("is_deleted", false)
    .order("day");

  lessons.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.title;
    select.appendChild(opt);
  });
}


// metricas pro

function computeFeedbackInsights(list) {
  if (!list.length) return;

  // ⭐ Rating promedio
  const ratings = list.filter(f => typeof f.rating === "number");
  const avgRating =
    ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;

  // 🔥 Fricción por lección
  const friction = {};
  list.forEach(f => {
    if (!f.lesson?.title) return;
    if (!friction[f.lesson.title]) {
      friction[f.lesson.title] = { total: 0, low: 0 };
    }
    friction[f.lesson.title].total++;
    if (f.rating <= 2) friction[f.lesson.title].low++;
  });

  const lessonsAtRisk = Object.entries(friction)
    .filter(([, v]) => v.low / v.total >= 0.4)
    .map(([k]) => k);

  console.group("📊 Feedback Insights");
  console.log("⭐ Rating promedio:", avgRating.toFixed(2));
  console.log("⚠️ Lecciones con fricción:", lessonsAtRisk);
  console.groupEnd();

  // 🤖 Input Coach IA
  window.__coachIA_feedback_input = list.map(f => ({
    lesson: f.lesson?.title,
    rating: f.rating,
    comment: f.comment,
    user: f.profile?.full_name,
    created_at: f.created_at
  }));
}

// feedbackinsight
function renderFeedbackKpis(list) {
  if (!list || !list.length) {
    document.getElementById("kpiAvgRating").textContent = "—";
    document.getElementById("kpiTotalFeedback").textContent = "0";
    document.getElementById("kpiFrictionLessons").textContent = "0";
    document.getElementById("kpiQualityAlert").style.display = "none";
    return;
  }

  // ⭐ Rating promedio
  const ratings = list.filter(f => typeof f.rating === "number");
  const avgRating =
    ratings.reduce((sum, f) => sum + f.rating, 0) / ratings.length;

  // ⚠️ Fricción por lección
  const friction = {};
  list.forEach(f => {
    if (!f.lesson?.title) return;
    if (!friction[f.lesson.title]) {
      friction[f.lesson.title] = { total: 0, low: 0 };
    }
    friction[f.lesson.title].total++;
    if (f.rating <= 2) friction[f.lesson.title].low++;
  });

  const frictionLessons = Object.entries(friction)
    .filter(([, v]) => v.low / v.total >= 0.4);

  // 🔴 Alerta calidad
  const showAlert =
    avgRating < 3.5 || frictionLessons.length > 0;

  // 🎯 Render KPIs
  document.getElementById("kpiAvgRating").textContent =
    avgRating.toFixed(2);

  document.getElementById("kpiTotalFeedback").textContent =
    list.length;

  document.getElementById("kpiFrictionLessons").textContent =
    frictionLessons.length;

  document.getElementById("kpiQualityAlert").style.display =
    showAlert ? "block" : "none";
}


function renderCourseFeedback(list, append = false) {
  if (!append) feedbackTbody.innerHTML = "";

  if (!list.length && !append) {
    feedbackTbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-placeholder">
          No hay feedback aún.
        </td>
      </tr>`;
    return;
  }

  list.forEach(fb => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display:flex;flex-direction:column;gap:2px;">
          <span>${fb.profile?.full_name ?? "—"}</span>
          <span style="opacity:.7;font-size:12px;">
            ${fb.profile?.email ?? "—"}
          </span>
        </div>
      </td>
      <td>${fb.lesson?.title ?? "—"}</td>
      <td>${fb.day ? `Día ${fb.day}` : "—"}</td>
      <td>${fb.rating ?? "—"}</td>
      <td style="max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${fb.comment ?? "—"}
      </td>
      <td>${new Date(fb.created_at).toLocaleString()}</td>
    `;
    feedbackTbody.appendChild(tr);
  });
}


// /admin/js/admin-course-details.js
import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

let courseId = null;
let courseLessonsCache = [];

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

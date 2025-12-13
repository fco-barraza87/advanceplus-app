// /admin/js/admin-course-details.js

import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

let courseId = null;

// Helpers DOM
const $ = (id) => document.getElementById(id);


// -------------------------------------------
// INIT
// -------------------------------------------
async function init() {
  await requireAdmin();

  courseId = new URLSearchParams(window.location.search).get("id");

  setupSidebarToggle();
  setupTabs();
  setupActions();

  if (courseId) {
    await loadCourse(courseId);
    await loadCourseLessons(); // 👈 AQUÍ
  } else {
    setupNewCourseMode();
  }
}

document.addEventListener("DOMContentLoaded", init);

// -------------------------------------------
// SIDEBAR TOGGLE
// -------------------------------------------
function setupSidebarToggle() {
  const btn = $("sidebarToggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    document.querySelector(".admin-sidebar")?.classList.toggle("sidebar-closed");
    document.querySelector(".admin-header-bar")?.classList.toggle("header-shifted");
  });
}

// -------------------------------------------
// TABS
// -------------------------------------------
function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      tabButtons.forEach((b) => b.classList.remove("tab-button-active"));
      btn.classList.add("tab-button-active");

      panels.forEach((p) => {
        if (p.id === `tab-${target}`) {
          p.classList.add("tab-panel-active");
        } else {
          p.classList.remove("tab-panel-active");
        }
      });
    });
  });
}

// -------------------------------------------
// LOAD COURSE (modo edición)
// -------------------------------------------
async function loadCourse(id) {
  console.log("[admin] Cargando curso", id);

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[admin] Error cargando curso:", error);
    alert("No se pudo cargar el curso.");
    return;
  }

  // Títulos
  $("pageCourseTitle").textContent = data.title || "Curso sin título";
  $("breadcrumbCourseTitle").textContent = data.title || "Curso sin título";

  // Metadatos
  $("metaId").textContent = data.id || "—";
  $("metaCreated").textContent = formatDate(data.created_at);
  $("metaUpdated").textContent = formatDate(data.updated_at);

  // Campos básicos
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

  $("inputPriceChf").value = data.price_chf ?? "";
  $("inputSalePriceChf").value = data.sale_price_chf ?? "";

  $("checkboxIsPaid").checked = !!data.is_paid;
  $("checkboxActive").checked = data.active !== false; // si null, asumimos activo

  // Contenido y medios
  $("textareaDescription").value = data.description ?? "";
  $("inputCoverUrl").value = data.cover_url ?? "";
  $("inputIntroAudioUrl").value = data.intro_audio_url ?? "";
  $("inputIntroVideoUrl").value = data.intro_video_url ?? "";
  $("inputSystemeUrl").value = data.systeme_checkout_url ?? "";

  console.log("[admin] Curso cargado correctamente");
}

// -------------------------------------------
// NEW COURSE MODE
// -------------------------------------------
function setupNewCourseMode() {
  console.log("[admin] Modo creación de nuevo curso");

  $("pageCourseTitle").textContent = "Nuevo curso";
  $("breadcrumbCourseTitle").textContent = "Nuevo curso";
  $("metaId").textContent = "—";
  $("metaCreated").textContent = "—";
  $("metaUpdated").textContent = "—";

  // No tiene sentido desactivar un curso que aún no existe
  const btnSoftDelete = $("btnSoftDelete");
  if (btnSoftDelete) {
    btnSoftDelete.style.display = "none";
  }
}

// -------------------------------------------
// ACCIONES: GUARDAR / SOFT DELETE / IR A LECCIONES
// -------------------------------------------
function setupActions() {
  const btnSave = $("btnSaveCourse");
  if (btnSave) {
    btnSave.addEventListener("click", onSaveCourse);
  }

  const btnSoftDelete = $("btnSoftDelete");
  if (btnSoftDelete) {
    btnSoftDelete.addEventListener("click", onSoftDelete);
  }

  const btnGoLessons = $("btnGoLessons");
  if (btnGoLessons) {
    btnGoLessons.addEventListener("click", () => {
      if (!courseId) {
        alert("Primero guarda el curso para poder gestionar sus lecciones.");
        return;
      }
      window.location.href = `/admin/lessons.html?course_id=${courseId}`;
    });
  }

  // Logout header (si lo usas así en otras páginas)
  const logoutBtn = $("adminLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth/login.html";
    });
  }
}

// -------------------------------------------
// SAVE COURSE (insert o update)
// -------------------------------------------
async function onSaveCourse() {
  const payload = collectPayload();
  if (!validateRequired(payload)) return;

  if (courseId) {
    // UPDATE
    console.log("[admin] Actualizando curso", courseId);
    const { error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", courseId);

    if (error) {
      console.error("[admin] Error actualizando curso:", error);
      alert("Error al guardar los cambios del curso.");
      return;
    }

    alert("Curso actualizado correctamente.");
  } else {
    // INSERT
    console.log("[admin] Creando nuevo curso");
    const { data, error } = await supabase
      .from("courses")
      .insert(payload)
      .select("id, title")
      .single();

    if (error) {
      console.error("[admin] Error creando curso:", error);
      alert("Error al crear el curso. Revisa los campos obligatorios.");
      return;
    }

    alert("Curso creado correctamente.");
    const newId = data.id;
    window.location.href = `/admin/course-details.html?id=${newId}`;
  }
}

// -------------------------------------------
// SOFT DELETE (active = false)
// -------------------------------------------
async function onSoftDelete() {
  if (!courseId) return;

  const ok = confirm(
    "¿Seguro que quieres desactivar este curso?\nNo se eliminará, pero dejará de estar visible para los usuarios."
  );
  if (!ok) return;

  const { error } = await supabase
    .from("courses")
    .update({ active: false })
    .eq("id", courseId);

  if (error) {
    console.error("[admin] Error desactivando curso:", error);
    alert("No se pudo desactivar el curso.");
    return;
  }

  $("checkboxActive").checked = false;
  alert("Curso desactivado correctamente.");
}

// -------------------------------------------
// PAYLOAD
// -------------------------------------------
function collectPayload() {
  const tagsRaw = $("inputTags").value || "";
  const tagsArray = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const toNumberOrNull = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  };

  return {
    title: $("inputTitle").value.trim() || null,
    subtitle: $("inputSubtitle").value.trim() || null,
    slug: $("inputSlug").value.trim() || null,
    description: $("textareaDescription").value.trim() || null,
    category: $("inputCategory").value.trim() || null,

    visibility: $("selectVisibility").value || "public",
    progression_type: $("selectProgression").value || "free",

    duration_days: toNumberOrNull($("inputDurationDays").value),
    level: toNumberOrNull($("inputLevel").value),
    xp_reward: toNumberOrNull($("inputXpReward").value),

    tags: tagsArray.length > 0 ? tagsArray : null,

    price_chf: toNumberOrNull($("inputPriceChf").value),
    sale_price_chf: toNumberOrNull($("inputSalePriceChf").value),

    is_paid: $("checkboxIsPaid").checked,
    active: $("checkboxActive").checked,

    cover_url: $("inputCoverUrl").value.trim() || null,
    intro_audio_url: $("inputIntroAudioUrl").value.trim() || null,
    intro_video_url: $("inputIntroVideoUrl").value.trim() || null,
    systeme_checkout_url: $("inputSystemeUrl").value.trim() || null
  };
}

// -------------------------------------------
// VALIDACIÓN CAMPOS OBLIGATORIOS
// (según definición de la tabla courses: NOT NULL)
// -------------------------------------------
function validateRequired(payload) {
  const missing = [];

  if (!payload.title) missing.push("Título");
  if (!payload.slug) missing.push("Slug");
  if (!payload.description) missing.push("Descripción");
  if (!payload.category) missing.push("Categoría");
  if (!payload.duration_days) missing.push("Duración (días)");
  if (!payload.level) missing.push("Nivel");
  if (!payload.cover_url) missing.push("URL de portada");

  if (missing.length > 0) {
    alert(
      "Faltan campos obligatorios:\n\n- " +
      missing.join("\n- ")
    );
    return false;
  }

  return true;
}

// -------------------------------------------
// UTIL
// -------------------------------------------
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}


// =======================================================
// LECCIONES DEL CURSO
// =======================================================

const lessonsTbody = document.getElementById("courseLessonsBody");
const btnNewLesson = document.getElementById("btnNewLesson");

// Botón nueva lección
btnNewLesson?.addEventListener("click", () => {
  if (!courseId) {
    alert("Guarda el curso antes de crear lecciones.");
    return;
  }
  window.location.href =
    `/admin/lesson-details.html?course_id=${courseId}`;
});


// Cargar lecciones
async function loadCourseLessons() {
  if (!lessonsTbody || !courseId) return;

  const { data, error } = await supabase
    .from("lessons")
    .select("id, day, title, xp_reward, is_checkpoint")
    .eq("course_id", courseId)
    .order("day", { ascending: true });

  if (error) {
    console.error("[admin] Error cargando lecciones", error);
    lessonsTbody.innerHTML = `
      <tr><td colspan="5">Error cargando lecciones</td></tr>
    `;
    return;
  }

  if (!data.length) {
    lessonsTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-placeholder">
          Este curso aún no tiene lecciones.
        </td>
      </tr>
    `;
    return;
  }

  lessonsTbody.innerHTML = "";

  data.forEach(lesson => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>Día ${lesson.day}</td>
      <td>${lesson.title ?? "(Sin título)"}</td>
      <td>${lesson.xp_reward ?? 0}</td>
      <td>${lesson.is_checkpoint ? "✔" : "—"}</td>
      <td class="table-actions">
        <button class="btn-icon" onclick="moveLessonUp('${lesson.id}', ${lesson.day})">↑</button>
        <button class="btn-icon" onclick="moveLessonDown('${lesson.id}', ${lesson.day})">↓</button>
        <button class="btn-small"
          onclick="editLesson('${lesson.id}')">
          Editar
        </button>
        <button class="btn-small btn-outline"
          onclick="duplicateLesson('${lesson.id}')">
          Duplicar
        </button>
      </td>
    `;

    lessonsTbody.appendChild(tr);
  });
}

async function moveLessonUp(lessonId, currentDay) {
  if (currentDay <= 1) return;

  await swapLessonDay(lessonId, currentDay, currentDay - 1);
}

async function moveLessonDown(lessonId, currentDay) {
  await swapLessonDay(lessonId, currentDay, currentDay + 1);
}

async function swapLessonDay(lessonId, fromDay, toDay) {
  if (!courseId) return;

  // buscar la lección vecina
  const { data: other, error } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", toDay)
    .single();

  if (error || !other) return;

  // swap
  await supabase.from("lessons").update({ day: toDay }).eq("id", lessonId);
  await supabase.from("lessons").update({ day: fromDay }).eq("id", other.id);

  // recargar tabla
  await loadCourseLessons();
}


// Navegación
window.editLesson = (id) => {
  window.location.href = `/admin/lesson-details.html?id=${id}`;
};

window.duplicateLesson = (id) => {
  window.location.href = `/admin/lesson-details.html?duplicate=${id}&course_id=${courseId}`;
};

// Ejecutar al cargar curso
loadCourseLessons();


// =======================================================
// REORDENAR LECCIONES (UP / DOWN)
// =======================================================

window.moveLessonUp = async (lessonId, currentDay) => {
  if (currentDay <= 1) return;

  await swapLessonDays(lessonId, currentDay, currentDay - 1);
};

window.moveLessonDown = async (lessonId, currentDay) => {
  await swapLessonDays(lessonId, currentDay, currentDay + 1);
};

async function swapLessonDays(lessonId, dayA, dayB) {
  // 1. Buscar la otra lección
  const { data: otherLesson, error: fetchError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("day", dayB)
    .single();

  if (fetchError || !otherLesson) {
    console.warn("No hay lección para intercambiar");
    return;
  }

  // 2. Intercambiar días (transacción lógica)
  const { error: updateError1 } = await supabase
    .from("lessons")
    .update({ day: dayB })
    .eq("id", lessonId);

  const { error: updateError2 } = await supabase
    .from("lessons")
    .update({ day: dayA })
    .eq("id", otherLesson.id);

  if (updateError1 || updateError2) {
    alert("Error reordenando lecciones");
    console.error(updateError1 || updateError2);
    return;
  }

  // 3. Refrescar tabla
  await loadCourseLessons();
};

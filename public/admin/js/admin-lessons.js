// /admin/js/admin-lessons.js
import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

const tbody = document.getElementById("lessonsTableBody");

// Filtros
const searchInput = document.getElementById("searchInput");
const courseFilter = document.getElementById("courseFilter");
const checkpointFilter = document.getElementById("checkpointFilter");
const tagFilter = document.getElementById("tagFilter");

// Botones cabecera
const sidebarToggle = document.getElementById("sidebarToggle");
const logoutBtn = document.getElementById("adminLogoutBtn");
const userLabel = document.getElementById("adminUserLabel");
const btnNewLesson = document.getElementById("btnNewLesson");

let allLessons = [];
let coursesMap = {};

// =======================================================
// Inicialización
// =======================================================

async function init() {
  await requireAdmin();
  await loadCurrentAdminName();
  setupHeaderEvents();

  await loadCoursesMap();
  await loadLessons();
  setupFilterEvents();
}

// =======================================================
// Cargar nombre en header (simple)
// =======================================================

async function loadCurrentAdminName() {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    userLabel.textContent = user.email || "Admin";
  } catch (err) {
    console.warn("[admin] No se pudo leer el usuario", err);
  }
}

// Header: toggle sidebar + logout
function setupHeaderEvents() {
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      document.querySelector(".admin-sidebar")?.classList.toggle("sidebar-closed");
      document.querySelector(".admin-header-bar")?.classList.toggle("header-shifted");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth/login.html";
    });
  }

  if (btnNewLesson) {
    btnNewLesson.addEventListener("click", () => {
      // Por ahora solo redirige al editor (se implementará en el siguiente módulo)
      window.location.href = "/admin/lesson-details.html?mode=new";
    });
  }
}

// =======================================================
// Cargar cursos (para mostrar nombres y filtro)
// =======================================================

async function loadCoursesMap() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .order("title", { ascending: true });

  if (error) {
    console.error("Error cargando cursos:", error);
    return;
  }

  coursesMap = {};
  (data || []).forEach(c => {
    coursesMap[c.id] = c.title;
  });

  // Poblar filtro de cursos
  Object.entries(coursesMap).forEach(([id, title]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = title;
    courseFilter.appendChild(opt);
  });
}

// =======================================================
// Cargar lecciones
// =======================================================

async function loadLessons() {
  const { data, error } = await supabase
    .from("lessons")
    .select(`
      id,
      course_id,
      day,
      title,
      subtitle,
      duration,
      xp_reward,
      tags,
      is_checkpoint,
      updated_at
    `)
    .order("course_id", { ascending: true })
    .order("day", { ascending: true });

  if (error) {
    console.error("Error cargando lecciones:", error);
    return;
  }

  allLessons = data || [];
  applyFilters();
}

// =======================================================
// Render tabla
// =======================================================

function renderLessons(list) {
  tbody.innerHTML = "";

  list.forEach(lesson => {
    const tr = document.createElement("tr");

    const courseName = coursesMap[lesson.course_id] || "(Sin curso)";
    const tags = Array.isArray(lesson.tags) ? lesson.tags : [];
    const updated = lesson.updated_at
      ? new Date(lesson.updated_at).toLocaleDateString("es-CL")
      : "-";

    tr.innerHTML = `
      <td>
        <span class="lesson-course">${courseName}</span>
      </td>

      <td>${lesson.day ?? ""}</td>

      <td>
        <div class="lesson-title-main">${lesson.title || "(Sin título)"}</div>
        ${
          lesson.subtitle
            ? `<div class="lesson-title-sub">${lesson.subtitle}</div>`
            : ""
        }
      </td>

      <td>${lesson.duration ? `${lesson.duration} min` : "-"}</td>

      <td>${lesson.xp_reward ?? 0}</td>

      <td>
        ${tags.map(t => `<span class="tag-chip">${t}</span>`).join("") || "-"}
      </td>

      <td>
        ${
          lesson.is_checkpoint
            ? `<span class="checkpoint-pill checkpoint-yes">Checkpoint</span>`
            : `<span class="checkpoint-pill checkpoint-no">Normal</span>`
        }
      </td>

      <td>${updated}</td>

      <td>
        <div class="order-controls">
          <button class="btn-icon" data-action="up" data-id="${lesson.id}">↑</button>
          <button class="btn-icon" data-action="down" data-id="${lesson.id}">↓</button>
        </div>
      </td>

      <td>
        <button class="btn-small" data-action="edit" data-id="${lesson.id}">
          Editar
        </button>
        <button class="btn-small" data-action="duplicate" data-id="${lesson.id}">
          Duplicar
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// =======================================================
// Filtros
// =======================================================

function setupFilterEvents() {
  searchInput.addEventListener("input", applyFilters);
  courseFilter.addEventListener("change", applyFilters);
  checkpointFilter.addEventListener("change", applyFilters);
  tagFilter.addEventListener("input", applyFilters);

  // Event delegation para botones de la tabla
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (!id || !action) return;

    if (action === "edit") {
      window.location.href = `/admin/lesson-details.html?id=${id}`;
    }

    if (action === "duplicate") {
      await duplicateLesson(id);
    }

    if (action === "up" || action === "down") {
      await moveLesson(id, action);
    }
  });
}

function applyFilters() {
  let filtered = [...allLessons];

  const search = searchInput.value.trim().toLowerCase();
  const course = courseFilter.value;
  const checkpoint = checkpointFilter.value;
  const tagText = tagFilter.value.trim().toLowerCase();

  if (search) {
    filtered = filtered.filter(l =>
      (l.title || "").toLowerCase().includes(search) ||
      (l.subtitle || "").toLowerCase().includes(search)
    );
  }

  if (course) {
    filtered = filtered.filter(l => l.course_id === course);
  }

  if (checkpoint === "1") {
    filtered = filtered.filter(l => !!l.is_checkpoint);
  } else if (checkpoint === "0") {
    filtered = filtered.filter(l => !l.is_checkpoint);
  }

  if (tagText) {
    filtered = filtered.filter(l => {
      const tags = Array.isArray(l.tags) ? l.tags : [];
      return tags.some(t => t.toLowerCase().includes(tagText));
    });
  }

  renderLessons(filtered);
}

// =======================================================
// Reordenar por día (flechas)
// =======================================================

async function moveLesson(id, direction) {
  const lesson = allLessons.find(l => l.id === id);
  if (!lesson) return;

  const sameCourse = allLessons
    .filter(l => l.course_id === lesson.course_id)
    .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));

  const index = sameCourse.findIndex(l => l.id === id);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sameCourse.length) {
    return; // ya está al inicio o final
  }

  const other = sameCourse[swapIndex];

  // Intercambiar los valores de day
  const dayA = lesson.day ?? 0;
  const dayB = other.day ?? 0;

  const { error: err1 } = await supabase
    .from("lessons")
    .update({ day: dayB })
    .eq("id", lesson.id);

  if (err1) {
    console.error("Error moviendo lección (1):", err1);
    return;
  }

  const { error: err2 } = await supabase
    .from("lessons")
    .update({ day: dayA })
    .eq("id", other.id);

  if (err2) {
    console.error("Error moviendo lección (2):", err2);
    return;
  }

  await loadLessons();
}

// =======================================================
// Duplicar lección
// =======================================================

async function duplicateLesson(id) {
  const original = allLessons.find(l => l.id === id);
  if (!original) return;

  const sameCourse = allLessons.filter(l => l.course_id === original.course_id);
  const maxDay = sameCourse.reduce(
    (max, l) => Math.max(max, l.day ?? 0),
    0
  );

  const newLesson = {
    course_id: original.course_id,
    day: maxDay + 1,
    title: `${original.title || "Lección"} (copia)`,
    subtitle: original.subtitle,
    content_html: original.content_html,
    audio_url: original.audio_url,
    duration: original.duration,
    tags: original.tags,
    xp_reward: original.xp_reward,
    text_content: original.text_content,
    exercise_content: original.exercise_content,
    image_url: original.image_url,
    video_url: original.video_url,
    meditation_url: original.meditation_url,
    ai_prompt: original.ai_prompt,
    ai_meta: original.ai_meta,
    download_url: original.download_url,
    quiz_json: original.quiz_json,
    is_checkpoint: original.is_checkpoint,
    version: (original.version ?? 1) + 1
    // ⚠️ Aquí podríamos añadir un futuro campo "visible"
  };

  const { error } = await supabase.from("lessons").insert(newLesson);

  if (error) {
    console.error("Error duplicando lección:", error);
    return;
  }

  await loadLessons();
}

// =======================================================
// Lanzar
// =======================================================

init();

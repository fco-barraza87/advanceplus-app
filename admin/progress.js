// ============================================================
//  PROGRESS ADMIN — Advance+
//  Version U3 — 3 Columnas
// ============================================================

import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin.js";

requireAdmin();

// ============================================================
//  ESTADO GLOBAL
// ============================================================

let selectedUser = null;
let selectedCourse = null;

// ============================================================
//  Cargar Usuarios (columna 1)
// ============================================================

async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = `<tr><td colspan="4">Cargando...</td></tr>`;

  // 1) Obtener perfiles
  const { data: profiles, error: e1 } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  if (e1) {
    console.error("Error cargando perfiles:", e1);
    tbody.innerHTML = `<tr><td colspan="4">Error cargando usuarios</td></tr>`;
    return;
  }

  // 2) Obtener user_stats
  const { data: stats, error: e2 } = await supabase
    .from("user_stats")
    .select("user_id, xp_total, level");

  if (e2) {
    console.error("Error cargando stats:", e2);
    tbody.innerHTML = `<tr><td colspan="4">Error cargando estadísticas</td></tr>`;
    return;
  }

  // 3) Mapear user_stats por ID
  const statsMap = {};
  stats.forEach(s => {
    statsMap[s.user_id] = s;
  });

  // 4) Renderizar la tabla
  tbody.innerHTML = "";

  profiles.forEach((u) => {
    const xp = statsMap[u.id]?.xp_total ?? 0;

    const tr = document.createElement("tr");
    tr.classList.add("admin-row-click");

    tr.innerHTML = `
      <td><div class="avatar-sm">${getInitials(u.full_name)}</div></td>
      <td>${u.full_name}</td>
      <td>${u.email}</td>
      <td>${xp}</td>
    `;

    tr.onclick = () => {
      selectedUser = u;
      highlightSelectedRow(tr, tbody);
      loadUserCourses(u.id);
      clearProgressTable();
    };

    tbody.appendChild(tr);
  });
}


// ============================================================
//  Cargar Cursos del Usuario (columna 2)
// ============================================================

async function loadUserCourses(userId) {
  const tbody = document.getElementById("coursesTableBody");
  tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

  const { data, error } = await supabase
    .from("user_courses")
    .select(`
      id,
      course_id,
      status,
      xp_gained,
      progress_pct,
      courses (
        id,
        title,
        progression_type
      )
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("Error cargando cursos:", error);
    tbody.innerHTML = `<tr><td colspan="5">Error cargando cursos</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  data.forEach((uc) => {
    const tr = document.createElement("tr");
    tr.classList.add("admin-row-click");

    tr.innerHTML = `
      <td>${uc.courses.title}</td>
      <td>${Math.round(uc.progress_pct ?? 0)}%</td>
      <td>${uc.xp_gained ?? 0}</td>
      <td>${uc.status}</td>
      <td>
        <button class="btn-small" data-action="open">Abrir</button>
      </td>
    `;

    tr.querySelector("[data-action='open']").onclick = (e) => {
      e.stopPropagation();
      selectedCourse = uc;
      highlightSelectedRow(tr, tbody);
      loadCourseProgress(uc.course_id, userId);
    };

    tbody.appendChild(tr);
  });
}

// ============================================================
//  Cargar progreso por día (columna 3)
// ============================================================

async function loadCourseProgress(courseId, userId) {
  const tbody = document.getElementById("progressTableBody");
  tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("day, title, xp_reward")
    .eq("course_id", courseId)
    .order("day");

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  const progressMap = {};
  progress?.forEach((p) => (progressMap[p.day] = p));

  tbody.innerHTML = "";

  lessons.forEach((lesson) => {
    const p = progressMap[lesson.day];

    const completed = p?.completed ? "Sí" : "No";
    const xp = p?.xp ?? 0;
    const fecha = p?.updated_at
      ? new Date(p.updated_at).toLocaleDateString()
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${lesson.day}</td>
      <td>${lesson.title}</td>
      <td>${completed}</td>
      <td>${xp}</td>
      <td>${fecha}</td>
      <td>
        <button class="btn-small" data-action="complete">✔</button>
        <button class="btn-small btn-danger" data-action="reset">↺</button>
      </td>
    `;

    tr.querySelector("[data-action='complete']").onclick = () =>
      setProgressDay(userId, courseId, lesson.day, lesson.xp_reward);

    tr.querySelector("[data-action='reset']").onclick = () =>
      resetProgressDay(userId, courseId, lesson.day);

    tbody.appendChild(tr);
  });
}

// ============================================================
//  Acciones: marcar completado, resetear día
// ============================================================

async function setProgressDay(userId, courseId, day, xpReward) {
  await supabase
    .from("progress")
    .upsert({
      user_id: userId,
      course_id: courseId,
      day,
      completed: true,
      xp: xpReward,
      updated_at: new Date().toISOString(),
    });

  loadCourseProgress(courseId, userId);
}

async function resetProgressDay(userId, courseId, day) {
  await supabase
    .from("progress")
    .update({
      completed: false,
      xp: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", day);

  loadCourseProgress(courseId, userId);
}

// ============================================================
//  Helpers
// ============================================================

function clearProgressTable() {
  document.getElementById("progressTableBody").innerHTML = "";
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function highlightSelectedRow(tr, tbody) {
  [...tbody.children].forEach((r) => r.classList.remove("selected"));
  tr.classList.add("selected");
}

// Ejecutar
loadUsers();

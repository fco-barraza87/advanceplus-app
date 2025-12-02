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

async function loadUserCourses(userId) {
  const tbody = document.getElementById("coursesTableBody");
  tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

  // 1) Obtener cursos asignados
  const { data: userCourses, error } = await supabase
    .from("user_courses")
    .select(`
      id,
      course_id,
      xp_gained,
      status,
      courses (
        id,
        title
      )
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("Error cargando cursos:", error);
    tbody.innerHTML = `<tr><td colspan="5">Error cargando cursos</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const uc of userCourses) {

    // 2) Obtener cantidad total de días del curso
    const { data: lessons } = await supabase
      .from("lessons")
      .select("day")
      .eq("course_id", uc.course_id);

    const totalDays = lessons.length;

    // 3) Obtener días completados por el usuario
    const { data: progressRows } = await supabase
      .from("progress")
      .select("completed")
      .eq("user_id", userId)
      .eq("course_id", uc.course_id);

    const completedDays = progressRows.filter(p => p.completed).length;

    // 4) Calcular progreso real %
    const realPct = totalDays > 0
      ? Math.round((completedDays / totalDays) * 100)
      : 0;

    // Render fila
    const tr = document.createElement("tr");
    tr.classList.add("admin-row-click");

    tr.innerHTML = `
      <td>${uc.courses.title}</td>
      <td>${realPct}%</td>
      <td>${uc.xp_gained ?? 0}</td>
      <td>${uc.status}</td>
      <td><button class="btn-small" data-action="open">Abrir</button></td>
    `;

    tr.querySelector("[data-action='open']").onclick = (e) => {
      e.stopPropagation();
      selectedCourse = uc;
      highlightSelectedRow(tr, tbody);
      loadCourseProgress(uc.course_id, userId);
    };

    tbody.appendChild(tr);
  }
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
  // 1. Obtener registro existente del día
  const { data: existing } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", day)
    .single();

  // Si NO existe, NO creamos nada
  if (!existing) {
    console.warn("No existe progreso para este día, no se creará uno nuevo.");
    return;
  }

  // Si ya estaba completado, no sumamos XP otra vez
  const xpToAdd = existing.completed ? 0 : xpReward;

  // 2. Actualizar el día
  await supabase
    .from("progress")
    .update({
      completed: true,
      xp: xpReward,
      updated_at: new Date().toISOString()
    })
    .eq("id", existing.id);

  // 3. Actualizar XP del curso (suma)
  await supabase.rpc("increment_user_course_xp", {
    p_user_id: userId,
    p_course_id: courseId,
    p_amount: xpToAdd
  });

  // 4. Actualizar XP total del usuario (suma)
  await supabase.rpc("increment_user_xp_total", {
    p_user_id: userId,
    p_amount: xpToAdd
  });

  loadCourseProgress(courseId, userId);
}

async function resetProgressDay(userId, courseId, day) {
  const { data: existing } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("day", day)
    .single();

  if (!existing) return;

  const xpToSubtract = existing.completed ? existing.xp ?? 0 : 0;

  // 1. Actualizar el día
  await supabase
    .from("progress")
    .update({
      completed: false,
      xp: 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", existing.id);

  // 2. Restar XP del curso
  await supabase.rpc("increment_user_course_xp", {
    p_user_id: userId,
    p_course_id: courseId,
    p_amount: -xpToSubtract
  });

  // 3. Restar XP total
  await supabase.rpc("increment_user_xp_total", {
    p_user_id: userId,
    p_amount: -xpToSubtract
  });

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

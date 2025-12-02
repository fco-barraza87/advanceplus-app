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

// Debounce de busqueda
function debounce(fn, delay = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ============================================================
//  Cargar Usuarios (columna 1)
// ============================================================

async function loadUsers(filterText = "") {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = `<tr><td colspan="4">Cargando usuarios...</td></tr>`;

  // 1) Query base de profiles
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .order("full_name", { ascending: true });

  const trimmed = filterText.trim();

  if (trimmed !== "") {
    const f = `%${trimmed}%`;
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(trimmed);

    const orParts = [
      `full_name.ilike.${f}`,
      `email.ilike.${f}`,
    ];
    if (isUuid) {
      orParts.push(`id.eq.${trimmed}`);
    }

    query = query.or(orParts.join(","));
  }

  const { data: profiles, error: e1 } = await query;

  if (e1) {
    console.error("Error cargando usuarios:", e1);
    tbody.innerHTML = `<tr><td colspan="4">Error cargando usuarios</td></tr>`;
    return;
  }

  // 2) Traer user_stats (xp_total, level)
  const { data: stats, error: e2 } = await supabase
    .from("user_stats")
    .select("user_id, xp_total, level");

  if (e2) {
    console.error("Error cargando stats:", e2);
    tbody.innerHTML = `<tr><td colspan="4">Error cargando estadísticas</td></tr>`;
    return;
  }

  const statsMap = {};
  stats.forEach(s => {
    statsMap[s.user_id] = s;
  });

  // 3) Render tabla
  tbody.innerHTML = "";

  profiles.forEach((u) => {
    const xp = statsMap[u.id]?.xp_total ?? 0;
    const initials = getInitials(u.full_name);

    const avatarHtml = u.avatar_url
      ? `<img src="${u.avatar_url}" alt="${u.full_name || ""}" class="avatar-sm avatar-img" />`
      : `<div class="avatar-sm">${initials}</div>`;

    const tr = document.createElement("tr");
    tr.classList.add("admin-row-click");

    tr.dataset.id = u.id;

    tr.innerHTML = `
      <td>${avatarHtml}</td>
      <td>${u.full_name || "Sin nombre"}</td>
      <td>${u.email}</td>
      <td>${xp}</td>
    `;

    tr.onclick = () => {
    selectedUser = u;

    // Persistencia
    localStorage.setItem("admin_selected_user", u.id);
    localStorage.removeItem("admin_selected_course");
      highlightSelectedRow(tr, tbody);
      loadUserCourses(u.id);
      clearProgressTable();
    };

    tbody.appendChild(tr);
    const persistedUserId = localStorage.getItem("admin_selected_user");

    if (persistedUserId) {
      const row = tbody.querySelector(`tr[data-id="${persistedUserId}"]`);
    if (row) row.click();
}
  });

}


document.getElementById("btnRefreshUsers").onclick = () => {
  loadUsers();
};

document.getElementById("btnRefreshUsers").onclick = () => {
  const btn = document.getElementById("btnRefreshUsers");
  btn.textContent = "⏳";
  setTimeout(() => (btn.textContent = "🔄"), 400);

  loadUsers();
};

// ============================================================
//  Cargar Cursos del Usuario (columna 2)
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
    <td>
        <button class="btn-small" data-action="open">Abrir</button>
        <button class="btn-small btn-danger" data-action="delete">Eliminar</button>
        <button class="btn-small" data-action="reset">Reset</button>
        <button class="btn-small" data-action="type">Modo</button>
    </td>
    `;


    tr.querySelector("[data-action='open']").onclick = (e) => {
      e.stopPropagation();
      selectedCourse = uc;

      // Persistencia
      localStorage.setItem("admin_selected_course", uc.course_id);

      highlightSelectedRow(tr, tbody);
      loadCourseProgress(uc.course_id, userId);
    };

    // Eliminar curso
    tr.querySelector("[data-action='delete']").onclick = async (e) => {
    e.stopPropagation();

    const ok = confirm(
        `¿Eliminar el curso "${uc.courses.title}" para ${selectedUser.full_name}?\n` +
        `Se borrará TODO su progreso y se restará el XP obtenido en este curso.`
    );
    if (!ok) return;

    const { error } = await supabase.rpc("admin_delete_course", {
        p_user_id: selectedUser.id,
        p_course_id: uc.course_id
    });

    if (error) {
        console.error("Error al eliminar curso:", error);
        alert("Hubo un error al eliminar el curso.");
        return;
    }

    // Refrescar UI
    loadUserCourses(selectedUser.id);
    clearProgressTable();
    loadUsers(); // refrescar XP total en panel usuarios
    };



    // Resetear curso completo
    tr.querySelector("[data-action='reset']").onclick = async (e) => {
    e.stopPropagation();

    const ok = confirm(
        `¿Resetear TODO el progreso del curso "${uc.courses.title}" para ${selectedUser.full_name}?\n` +
        `Esto pondrá todos los días como no completados y restará el XP del curso.`
    );
    if (!ok) return;

    // RPC transaccional
    const { error } = await supabase.rpc("admin_reset_course", {
        p_user_id: selectedUser.id,
        p_course_id: uc.course_id
    });

    if (error) {
        console.error("Error al resetear curso:", error);
        alert("Hubo un error al resetear el curso.");
        return;
    }

    // refrescar UI
    loadUserCourses(selectedUser.id);
    clearProgressTable();
    loadUsers(); // refrescar XP total del usuario
    };



    // Cambiar modo (progression_type)
    tr.querySelector("[data-action='type']").onclick = async (e) => {
    e.stopPropagation();

    const nextMap = {
        "free": "daily",
        "daily": "strict",
        "strict": "free"
    };

   const ok = confirm(
    `Modo actual del curso "${uc.courses.title}": ${actual}\n` +
    `¿Cambiar a modo: ${next}?`
    );
    if (!ok) return;

    const next = nextMap[uc.courses.progression_type] ?? "free";

    await supabase
        .from("courses")
        .update({ progression_type: next })
        .eq("id", uc.course_id);

    loadUserCourses(selectedUser.id);
    };
        

    tbody.appendChild(tr);
  }
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

// Modal DOM
const modalAdd = document.getElementById("modalAddCourse");
const selectCourseToAdd = document.getElementById("selectCourseToAdd");
const btnAddCourse = document.getElementById("btnAddCourse");

// Abrir modal
btnAddCourse.onclick = async () => {
  if (!selectedUser) return alert("Seleccione un usuario primero.");

  modalAdd.classList.remove("hidden");

  // cargar cursos activos
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title")
    .eq("active", true)
    .order("title");

  selectCourseToAdd.innerHTML = "";
  courses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    selectCourseToAdd.appendChild(opt);
  });
};

// Cerrar modal
document.getElementById("btnCancelAddCourse").onclick = () => {
  modalAdd.classList.add("hidden");
};


document.getElementById("btnConfirmAddCourse").onclick = async () => {

  const courseId = selectCourseToAdd.value;
  if (!courseId) return;

  // 1. Insertar en user_courses
  const { error } = await supabase
    .from("user_courses")
    .insert({
      user_id: selectedUser.id,
      course_id: courseId,
      status: "active",
      xp_gained: 0,
      progress_pct: 0
    });

  if (error) {
    alert("Este curso ya está agregado o hubo un error.");
    return;
  }

  modalAdd.classList.add("hidden");

  loadUserCourses(selectedUser.id);
};


const searchInput = document.getElementById("searchUserInput");
if (searchInput) {
  const debouncedSearch = debounce((value) => {
    loadUsers(value);
  }, 300);

  searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value);
  });
}


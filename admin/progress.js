// /admin/progress.js
import { supabase } from "/js/supabase.js";
import { requireAdmin, setAdminHeader } from "/admin/js/admin.js";

let users = [];
let courses = [];
let selectedUser = null;
let selectedCourse = null;

document.addEventListener("DOMContentLoaded", async () => {
  await requireAdmin();
  setAdminHeader("Panel Admin · Progreso", "Control avanzado de usuarios, cursos y progreso por día.");

  await loadUsers();
  await loadAllCourses();

  setupEvents();
});

/* ============================================================
   SETUP DE EVENTOS
============================================================ */
function setupEvents() {
  document.getElementById("searchUser").addEventListener("input", filterUsers);

  document.getElementById("btnAddCourse").addEventListener("click", async () => {
    if (!selectedUser) return alert("Selecciona un usuario primero.");

    const courseId = prompt("Ingresa el ID del curso a asignar:");
    if (!courseId) return;

    await addCourseToUser(selectedUser.id, courseId);
    await loadUserCourses(selectedUser.id);
  });
}

/* ============================================================
   USERS
============================================================ */
async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = `<tr><td colspan="6">Cargando usuarios...</td></tr>`;

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      avatar_url,
      user_stats:xp_total, 
      level:user_stats.level
    `);

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="6">Error cargando usuarios</td></tr>`;
    return;
  }

  users = data;
  renderUsersTable(users);
}

function renderUsersTable(usersFiltered) {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = "";

  usersFiltered.forEach(user => {
    const tr = document.createElement("tr");
    tr.classList.add("admin-row-click");

    const avatar = user.avatar_url 
      ? `<img src="${user.avatar_url}" style="width:32px; height:32px; border-radius:50%;">`
      : `<div style="
            width:32px; height:32px; border-radius:50%;
            background:#334; 
            display:flex; align-items:center; justify-content:center;
            color:#fff; font-size:0.8rem;">
            ${user.full_name ? user.full_name.charAt(0).toUpperCase() : "?"}
         </div>`;

    tr.innerHTML = `
      <td>${avatar}</td>
      <td>${user.full_name ?? "-"}</td>
      <td>${user.email}</td>
      <td>${user.xp_total ?? 0}</td>
      <td>${user.level ?? 1}</td>
      <td style="font-size:0.7rem; color:#9bb;">${user.id}</td>
    `;

    tr.addEventListener("click", () => {
      selectedUser = user;
      loadUserCourses(user.id);
    });

    tbody.appendChild(tr);
  });
}

function filterUsers(e) {
  const text = e.target.value.toLowerCase();
  const filtered = users.filter(u =>
    (u.full_name ?? "").toLowerCase().includes(text) ||
    (u.email ?? "").toLowerCase().includes(text) ||
    (u.id ?? "").toLowerCase().includes(text)
  );
  renderUsersTable(filtered);
}

/* ============================================================
   COURSES
============================================================ */
async function loadAllCourses() {
  const { data } = await supabase
    .from("courses")
    .select("id, title, duration_days, xp_reward");
  courses = data || [];
}

async function loadUserCourses(userId) {
  const tbody = document.getElementById("userCoursesTableBody");
  tbody.innerHTML = `<tr><td colspan="5">Cargando cursos...</td></tr>`;

  const { data, error } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="5">Error cargando cursos</td></tr>`;
    return;
  }

  renderUserCoursesTable(data);
}

function renderUserCoursesTable(userCourses) {
  const tbody = document.getElementById("userCoursesTableBody");
  tbody.innerHTML = "";

  userCourses.forEach(uc => {
    const course = courses.find(c => c.id === uc.course_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${course?.title ?? "Curso eliminado"}</td>
      <td>${(uc.progress_pct ?? 0)}%</td>
      <td>${uc.xp_gained ?? 0}</td>
      <td>${uc.status}</td>
      <td>
        <button class="btn-secondary" onclick="window.progressAdmin.selectCourse('${uc.course_id}')">Ver</button>
        <button class="btn-secondary" onclick="window.progressAdmin.resetCourse('${uc.course_id}')">Reset</button>
        <button class="btn-secondary" onclick="window.progressAdmin.removeCourse('${uc.course_id}')">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.progressAdmin = {
  selectCourse: async (courseId) => {
    selectedCourse = courseId;
    await loadCourseProgress(selectedUser.id, courseId);
  },

  resetCourse: async (courseId) => {
    if (!confirm("¿Resetear TODO el progreso del curso?")) return;

    await supabase
      .from("progress")
      .delete()
      .eq("user_id", selectedUser.id)
      .eq("course_id", courseId);

    await loadCourseProgress(selectedUser.id, courseId);
    alert("Curso reseteado.");
  },

  removeCourse: async (courseId) => {
    if (!confirm("¿Eliminar curso del usuario?")) return;

    await supabase
      .from("user_courses")
      .delete()
      .eq("user_id", selectedUser.id)
      .eq("course_id", courseId);

    await loadUserCourses(selectedUser.id);
    alert("Curso eliminado.");
  }
};

/* ============================================================
   PROGRESO POR DÍA
============================================================ */

async function loadCourseProgress(userId, courseId) {
  document.getElementById("progressTitle").textContent = "Progreso del curso";

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("day");

  const { data: progress } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  const merged = lessons.map(lesson => {
    const p = progress.find(x => x.day === lesson.day);
    return {
      day: lesson.day,
      title: lesson.title,
      completed: p?.completed ?? false,
      xp: p?.xp ?? 0,
      updated_at: p?.updated_at ?? null
    };
  });

  renderProgressTable(merged);
}

function renderProgressTable(rows) {
  const tbody = document.getElementById("progressTableBody");
  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.day}</td>
      <td>${r.title}</td>
      <td>${r.completed ? "✔" : "✘"}</td>
      <td>${r.xp}</td>
      <td>${r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "-"}</td>
      <td>
        <button class="btn-secondary" onclick="window.progressAdmin.completeDay(${r.day})">Completar</button>
        <button class="btn-secondary" onclick="window.progressAdmin.resetDay(${r.day})">Reset</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

window.progressAdmin.completeDay = async (day) => {
  if (!selectedUser || !selectedCourse) return;

  await supabase
    .from("progress")
    .upsert({
      user_id: selectedUser.id,
      course_id: selectedCourse,
      day: day,
      completed: true,
      xp: 25,
      updated_at: new Date()
    }, { onConflict: "user_id,course_id,day" });

  await loadCourseProgress(selectedUser.id, selectedCourse);
};

window.progressAdmin.resetDay = async (day) => {
  await supabase
    .from("progress")
    .delete()
    .eq("user_id", selectedUser.id)
    .eq("course_id", selectedCourse)
    .eq("day", day);

  await loadCourseProgress(selectedUser.id, selectedCourse);
};

/* END */

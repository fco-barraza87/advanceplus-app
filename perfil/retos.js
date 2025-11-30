import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";

const qs = (sel) => document.querySelector(sel);

/* ==========================================
   1. CARGAR RETOS ACTIVOS DESDE user_courses
========================================== */
async function loadActiveCourses(userId) {
  const { data: userCourses, error } = await supabase
    .from("user_courses")
    .select("course_id, status, started_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error cargando user_courses:", error);
    return [];
  }

  const activeCourses = [];

  for (const uc of userCourses || []) {
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select(
        "id, title, slug, cover_url, category, level, duration_days, active"
      )
      .eq("id", uc.course_id)
      .single();

    if (!cErr && course && course.active) {
      activeCourses.push(course);
    }
  }

  return activeCourses;
}

function renderActiveCoursesRetos(active, currentUser) {
  const grid = qs("#activeCoursesGrid");
  const msg = qs("#noActiveCourses");

  if (!grid || !msg) return;

  grid.innerHTML = "";

  if (!active.length) {
    msg.style.display = "block";
    return;
  }

  msg.style.display = "none";

  active.forEach((course) => {
    const card = document.createElement("article");
    card.className = "course-card clickable";
    card.dataset.id = course.id;

    const cover =
      course.cover_url ||
      "https://via.placeholder.com/600x300.png?text=Advance%2B";

    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover" />
        <span class="course-badge">${course.category || "Reto"}</span>
      </div>

      <div class="course-body">
        <div class="course-title">${course.title}</div>
        <div class="course-meta">${course.level || "Todos los niveles"}</div>
      </div>
    `;

    // Mismo comportamiento que en el dashboard:
    card.addEventListener("click", async () => {
      const { data: progressRows, error } = await supabase
        .from("progress")
        .select("day, completed")
        .eq("user_id", currentUser.id)
        .eq("course_id", course.id)
        .order("day", { ascending: true });

      let nextDay = 1;

      if (!error && progressRows?.length) {
        const completed = progressRows.filter((p) => p.completed);
        if (completed.length > 0) {
          const lastDone = completed[completed.length - 1].day;
          nextDay = lastDone + 1;
        }
      }

      if (nextDay > course.duration_days) {
        nextDay = course.duration_days;
      }

      window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
    });

    grid.appendChild(card);
  });
}

/* ==========================================
   2. RETOS DISPONIBLES (EXPLORAR)
========================================== */
async function loadAvailableCourses(userId) {
  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  if (cErr) {
    console.error("Error cargando courses:", cErr);
    return [];
  }

  const { data: myCourses, error: ucErr } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  if (ucErr) {
    console.error("Error cargando user_courses:", ucErr);
    return courses || [];
  }

  const ownedIds = new Set((myCourses || []).map((c) => c.course_id));
  return (courses || []).filter((c) => !ownedIds.has(c.id));
}

function renderAvailableCoursesRetos(courses) {
  const grid = qs("#allCoursesGrid");
  const msg = qs("#noCoursesMessage");

  if (!grid || !msg) return;

  grid.innerHTML = "";

  if (!courses.length) {
    msg.style.display = "block";
    return;
  }

  msg.style.display = "none";

  courses.forEach((course) => {
    const card = document.createElement("div");
    card.className = "course-card clickable";
    card.dataset.id = course.id;

    const cover =
      course.cover_url ||
      "https://via.placeholder.com/600x300.png?text=Advance%2B";

    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover" />
        <span class="course-badge">${course.category || "Reto"}</span>
      </div>

      <div class="course-body">
        <div class="course-title">${course.title}</div>
        <div class="course-meta">${course.level || ""}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `/curso-info/index.html?c=${course.id}`;
    });

    grid.appendChild(card);
  });
}

/* ==========================================
   3. INIT PÁGINA RETOS PERFIL
========================================== */
async function initRetosPerfil() {
  await protectUserView();

  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;
  if (!user) return;

  const active = await loadActiveCourses(user.id);
  renderActiveCoursesRetos(active, user);

  const available = await loadAvailableCourses(user.id);
  renderAvailableCoursesRetos(available);
}

document.addEventListener("DOMContentLoaded", initRetosPerfil);

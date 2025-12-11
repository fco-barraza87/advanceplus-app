import { supabase } from "/js/supabase.js";

async function loadDashboardMetrics() {
  console.log("[admin] Loading dashboard metrics...");

  await Promise.all([
    loadUserMetrics(),
    loadCourseMetrics(),
    loadActivityMetrics(),
  ]);

  // Actualizar sello de tiempo
  const updatedEl = document.getElementById("dashboard-last-updated");
  if (updatedEl) {
    const now = new Date();
    updatedEl.textContent =
      "Actualizado: " + now.toLocaleString("es-CH", { hour12: false });
  }
}

async function loadUserMetrics() {
  const totalEl = document.getElementById("metric-total-users");
  const activeEl = document.getElementById("metric-active-users");
  const adminsEl = document.getElementById("metric-admins");
  const coachesEl = document.getElementById("metric-coaches");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*"); // no nombramos columnas específicas para no romper nada

  if (error) {
    console.error("[admin] loadUserMetrics error:", error);
    return;
  }

  const rows = profiles || [];
  const totalUsers = rows.length;
  const admins = rows.filter((p) => p.role === "admin").length;
  const coaches = rows.filter((p) => p.role === "coach").length;

  // Campo opcional: onboarding_completed (solo si existe)
  const activeUsers = rows.filter((p) => p.onboarding_completed === true).length;

  if (totalEl) totalEl.textContent = totalUsers;
  if (activeEl) activeEl.textContent = activeUsers;
  if (adminsEl) adminsEl.textContent = admins;
  if (coachesEl) coachesEl.textContent = coaches;
}

async function loadCourseMetrics() {
  const totalEl = document.getElementById("metric-total-courses");
  const activeEl = document.getElementById("metric-active-courses");
  const prepEl = document.getElementById("metric-prep-courses");
  const publicEl = document.getElementById("metric-public-courses");

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*"); // tenemos confirmadas active, visibility

  if (error) {
    console.error("[admin] loadCourseMetrics error:", error);
    return;
  }

  const rows = courses || [];
  const totalCourses = rows.length;
  const activeCourses = rows.filter((c) => c.active === true).length;
  const prepCourses = rows.filter((c) => c.visibility === "in prep").length;
  const publicCourses = rows.filter((c) => c.visibility === "public").length;

  if (totalEl) totalEl.textContent = totalCourses;
  if (activeEl) activeEl.textContent = activeCourses;
  if (prepEl) prepEl.textContent = prepCourses;
  if (publicEl) publicEl.textContent = publicCourses;
}

async function loadActivityMetrics() {
  const completedEl = document.getElementById("metric-completed-lessons");

  const { data: progresses, error } = await supabase
    .from("progress")
    .select("*"); // no asumimos columnas en SQL

  if (error) {
    console.error("[admin] loadActivityMetrics error:", error);
    return;
  }

  const rows = progresses || [];
  // Campo opcional: completed (si no existe, será 0)
  const completedLessons = rows.filter((p) => p.completed === true).length;

  if (completedEl) completedEl.textContent = completedLessons;
}

// Inicializar solo cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardMetrics().then(() =>
    console.log("[admin] Dashboard metrics loaded")
  );
});

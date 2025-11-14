// /dashboard/dashboard.js
// Dashboard Advance+ conectado a Supabase
// Carga progreso + cursos + router dinámico

import { supabase } from "/js/supabase.js";
import { protectView } from "/js/router.js";

// Ejecutar protección dinámica
protectView();

// Elementos del DOM
const logoutBtn = document.getElementById("logoutBtn");
const progressContainer = document.getElementById("progressContainer");
const coursesContainer = document.getElementById("coursesContainer");

/* -----------------------------------------------------
   LOGOUT
----------------------------------------------------- */
logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
};

/* -----------------------------------------------------
   CARGA DE DATOS PRINCIPALES
----------------------------------------------------- */
async function initDashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  loadProgress(user.id);
  loadCourses(user.id);
}

/* -----------------------------------------------------
   PROGRESO DEL USUARIO
----------------------------------------------------- */
async function loadProgress(userId) {
  progressContainer.textContent = "Cargando...";

  const { data, error } = await supabase
    .from("gamification")
    .select("xp_total, level, streak_current")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    progressContainer.textContent = "No hay progreso disponible.";
    return;
  }

  progressContainer.innerHTML = `
    <div class="progress-box">
      <p><strong>Nivel:</strong> ${data.level}</p>
      <p><strong>XP Total:</strong> ${data.xp_total}</p>
      <p><strong>Racha:</strong> ${data.streak_current} días</p>
      <div class="xp-bar">
        <div style="width: ${Math.min((data.xp_total % 100), 100)}%"></div>
      </div>
    </div>
  `;
}

/* -----------------------------------------------------
   CURSOS DEL USUARIO
----------------------------------------------------- */
async function loadCourses(userId) {
  coursesContainer.textContent = "Cargando...";

  const { data, error } = await supabase
    .from("user_courses")
    .select("course_id, courses(title, cover_url, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    coursesContainer.textContent = "Aún no tienes cursos asignados.";
    return;
  }

  coursesContainer.innerHTML = "";

  data.forEach(item => {
    const course = item.courses;

    const card = document.createElement("div");
    card.className = "course-card";
    card.onclick = () => {
      window.location.href = `/curso/index.html?c=${course.slug}`;
    };

    card.innerHTML = `
      <img src="${course.cover_url}" class="course-cover" />
      <h3 class="course-title">${course.title}</h3>
    `;

    coursesContainer.appendChild(card);
  });
}

// Iniciar dashboard
initDashboard();

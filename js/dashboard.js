/* =========================================================
   DASHBOARD — ADVANCE+
   Compatible con tu HTML real
========================================================= */

import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";

protectUserView();

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */
const qs = (sel) => document.querySelector(sel);
const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

/* -------------------------------------------------------
   Header de usuario
------------------------------------------------------- */
function renderUserHeader(profile) {
  if (!profile) return;

  setText("userName", profile.display_name || "Usuario");
  setText("userRole", "Miembro Advance+");

  const avatar = qs("#userAvatar");

  if (avatar) {
    if (profile.avatar_url) {
      avatar.style.background = "transparent";
      avatar.style.border = "none";
      avatar.textContent = "";
      avatar.innerHTML = `<img src="${profile.avatar_url}" class="avatar-img" />`;
    } else {
      avatar.textContent =
        (profile.display_name || "?").substring(0, 1).toUpperCase();
    }
  }
}

/* -------------------------------------------------------
   Gamificación (XP, nivel, rachas)
------------------------------------------------------- */
function renderGamification(stats) {
  if (!stats) return;

  const xp = stats.xp_total ?? 0;
  const level = stats.level ?? 1;
  const streakCurrent = stats.streak_current ?? 0;
  const streakBest = stats.streak_best ?? 0;

  // calcular xp dentro del nivel
  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;

  // insertar
  setText("levelLabel", level);
  setText("xpTotalLabel", `${xp} XP`);
  setText("xpNextLabel", `${xpToNext} XP para el siguiente nivel`);
  setText("streakCurrent", streakCurrent);
  setText("streakBest", streakBest);

  // barra
  const bar = qs("#xpBarFill");
  if (bar) {
    const pct = Math.min(100, (xpInLevel / 100) * 100);
    setTimeout(() => {
      bar.style.width = `${pct}%`;
    }, 150);
  }
}

/* -------------------------------------------------------
   Cursos activos
------------------------------------------------------- */
function renderActiveCourses(list) {
  const grid = qs("#activeCoursesGrid");
  const emptyMsg = qs("#noActiveMessage");
  const counter = qs("#activeCount");

  if (!grid) return;

  grid.innerHTML = "";

  if (!list || list.length === 0) {
    if (emptyMsg) emptyMsg.style.display = "block";
    if (counter) counter.textContent = "0 retos activos";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";
  if (counter) counter.textContent = `${list.length} retos activos`;

  list.forEach((item) => {
    const c = item.courses;

    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <img src="${c.cover_url}" class="course-cover" alt="${c.title}">
      <div class="course-info">
        <h3>${c.title}</h3>
        <p>Día 1 de ${c.duration_days || 7}</p>
        <button class="btn-a"
                onclick="window.location.href='/leccion/index.html?course=${c.id}&day=1'">
                Continuar</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

/* -------------------------------------------------------
   Cursos disponibles
------------------------------------------------------- */
function renderAvailableCourses(all, active) {
  const grid = qs("#availableCoursesGrid");
  const emptyMsg = qs("#noAvailableMessage");

  if (!grid) return;

  grid.innerHTML = "";

  const activeIds = new Set(active.map((a) => a.courses.id));
  const available = all.filter((c) => !activeIds.has(c.id));

  if (available.length === 0) {
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";

  available.forEach((c) => {
    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <img src="${c.cover_url}" class="course-cover" alt="${c.title}">
      <div class="course-info">
        <span class="category-tag">${c.category}</span>
        <h3>${c.title}</h3>
        <p>${c.level}</p>
        <button class="btn-b">Ver detalles</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

/* -------------------------------------------------------
   Logout
------------------------------------------------------- */
function initLogout() {
  const btn = qs("#btnLogout");
  if (!btn) return;

  btn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

/* -------------------------------------------------------
   Cargar datos
------------------------------------------------------- */
async function loadDashboard() {
  // auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  renderUserHeader(profile);

  // stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .single();

  renderGamification(stats);

  // cursos activos
  const { data: active } = await supabase
    .from("user_courses")
    .select("course_id, courses(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  renderActiveCourses(active || []);

  // todos los cursos
  const { data: allCourses } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  renderAvailableCourses(allCourses || [], active || []);

  // logout
  initLogout();
}

/* -------------------------------------------------------
   Init
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", loadDashboard);



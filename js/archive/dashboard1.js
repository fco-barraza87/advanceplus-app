/* =========================================================
   DASHBOARD.JS — Advance+ Premium
   Lógica principal: carga perfil, stats, cursos activos y disponibles
========================================================= */

import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";

protectUserView(); // Protección obligatoria

/* -------------------------------------------------------
   Helpers simples
------------------------------------------------------- */
function qs(sel) {
  return document.querySelector(sel);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* -------------------------------------------------------
   Render header del usuario
------------------------------------------------------- */
function renderUserHeader(profile) {
  if (!profile) return;

  const nameEl = qs("#userName");
  const roleEl = qs("#userRole");
  const avatarEl = qs("#userAvatar");

  if (nameEl) nameEl.textContent = profile.display_name || "Usuario";
  if (roleEl) roleEl.textContent = "Miembro Advance+";

  if (avatarEl) {
    if (profile.avatar_url) avatarEl.src = profile.avatar_url;
    else avatarEl.textContent = (profile.display_name || "?").substring(0, 1);
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

  // Cálculo XP nivel
  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;

  // Insertar datos
  setText("levelLabel", level);
  setText("xpTotalLabel", `${xp} XP`);
  setText("xpNextLabel", `${xpToNext} XP para el siguiente nivel`);
  setText("streakCurrent", `${streakCurrent}`);
  setText("streakBest", `${streakBest}`);

  // Barra XP
  const xpBarFill = document.getElementById("xpBarFill");
  if (xpBarFill) {
    const percent = Math.min(100, (xpInLevel / 100) * 100);
    setTimeout(() => {
      xpBarFill.style.width = `${percent}%`;
    }, 150);
  }
}

/* -------------------------------------------------------
   Render cursos activos
------------------------------------------------------- */
function renderActiveCourses(list) {
  const container = qs("#activeCoursesList");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<p class="empty-msg">
      Aún no has comenzado ningún reto. Empieza por uno de los cursos recomendados abajo. 💪
    </p>`;
    return;
  }

  container.innerHTML = "";

  list.forEach((item) => {
    const c = item.courses;

    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <img class="course-cover" src="${c.cover_url}" alt="${c.title}" />
      <div class="course-info">
        <h3>${c.title}</h3>
        <p>Día 1 de ${c.duration_days || 7}</p>
        <button class="btn-a" onclick="window.location.href='/leccion/index.html?course=${c.id}&day=1'">
          Continuar
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/* -------------------------------------------------------
   Render cursos disponibles (no inscritos)
------------------------------------------------------- */
function renderAvailableCourses(allCourses, activeCourses) {
  const container = qs("#availableCoursesList");
  if (!container) return;

  const activeIds = new Set(activeCourses.map((c) => c.courses.id));

  const available = allCourses.filter((c) => !activeIds.has(c.id));

  container.innerHTML = "";

  available.forEach((c) => {
    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <img class="course-cover" src="${c.cover_url}" alt="${c.title}" />
      <div class="course-info">
        <span class="category-tag">${c.category}</span>
        <h3>${c.title}</h3>
        <p>${c.level}</p>
        <button class="btn-b">Ver detalles</button>
      </div>
    `;

    container.appendChild(card);
  });
}

/* -------------------------------------------------------
   Logout
------------------------------------------------------- */
async function setupLogout() {
  const logoutBtn = qs("#logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

/* -------------------------------------------------------
   Carga principal del dashboard
------------------------------------------------------- */
async function loadDashboard() {
  // 1. Obtener auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 2. Perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  renderUserHeader(profile);

  // 3. Stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .single();

  renderGamification(stats);

  // 4. Cursos activos
  const { data: active } = await supabase
    .from("user_courses")
    .select("course_id, courses(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  renderActiveCourses(active || []);

  // 5. Todos los cursos activos en catálogo
  const { data: available } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  renderAvailableCourses(available || [], active || []);

  // 6. Logout
  setupLogout();
}

/* -------------------------------------------------------
   Inicializar
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", loadDashboard);

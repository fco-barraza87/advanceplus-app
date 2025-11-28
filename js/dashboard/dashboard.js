// /js/dashboard.js
import { supabase } from "/js/supabase.js";
import { requireAuth, loadUserMinimalInfo, logout } from "/js/auth.js";

/**
 * Fórmula simple para XP por nivel.
 * Puedes ajustarla más adelante sin tocar la estructura.
 */
function xpForLevel(level) {
  const base = 100;
  const growth = 1.35;
  return Math.round(base * Math.pow(growth, level - 1));
}

/**
 * Dado el total de XP y el nivel actual,
 * calcula cuánto XP va dentro del nivel y cuánto falta.
 */
function getLevelProgress(xpTotal, level) {
  let xpBefore = 0;
  for (let l = 1; l < level; l++) {
    xpBefore += xpForLevel(l);
  }
  const currentLevelXp = xpForLevel(level);
  const xpIntoLevel = Math.max(0, xpTotal - xpBefore);
  const xpRemaining = Math.max(0, currentLevelXp - xpIntoLevel);
  const pct = currentLevelXp > 0 ? Math.min(100, (xpIntoLevel / currentLevelXp) * 100) : 0;

  return {
    xpIntoLevel,
    xpRemaining,
    pct,
    needed: currentLevelXp,
  };
}

async function loadHeaderInfo() {
  const info = await loadUserMinimalInfo();
  if (!info) return;

  const nameEl = document.getElementById("headerUserName");
  const roleEl = document.getElementById("headerUserRole");

  if (nameEl) nameEl.textContent = info.name || "Usuario";

  let roleLabel = "Usuario";
  if (info.role === "admin") roleLabel = "Admin";
  if (info.role === "coach") roleLabel = "Coach";

  if (roleEl) roleEl.textContent = roleLabel;
}

async function loadGamification(userId) {
  const levelEl = document.getElementById("userLevel");
  const xpTotalEl = document.getElementById("xpTotal");
  const xpNextTextEl = document.getElementById("xpNextText");
  const xpBarFill = document.getElementById("xpBarFill");
  const streakCurrentEl = document.getElementById("streakCurrent");
  const streakBestEl = document.getElementById("streakBest");

  const { data, error } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best, level")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.warn("No se pudo cargar user_stats, usando valores por defecto:", error.message);
  }

  const xp_total = data?.xp_total ?? 0;
  const level = data?.level ?? 1;
  const streak_current = data?.streak_current ?? 0;
  const streak_best = data?.streak_best ?? 0;

  if (levelEl) levelEl.textContent = String(level);
  if (xpTotalEl) xpTotalEl.textContent = `${xp_total} XP`;

  const { pct, xpRemaining, needed } = getLevelProgress(xp_total, level);

  if (xpBarFill) xpBarFill.style.width = `${pct}%`;

  if (xpNextTextEl) {
    if (xpRemaining <= 0 && xp_total > 0) {
      xpNextTextEl.textContent = "Nivel máximo alcanzado (ajusta la curva luego si quieres).";
    } else {
      xpNextTextEl.textContent = `Te faltan ${xpRemaining} XP para el siguiente nivel (de ${needed} XP).`;
    }
  }

  if (streakCurrentEl) streakCurrentEl.textContent = `${streak_current} 🔥`;
  if (streakBestEl) streakBestEl.textContent = `${streak_best} 🏆`;
}

async function loadCourses(userId) {
  const activeGrid = document.getElementById("activeCoursesGrid");
  const availGrid = document.getElementById("availableCoursesGrid");
  const activeCountEl = document.getElementById("activeCount");
  const noActiveMsg = document.getElementById("noActiveMessage");
  const noAvailableMsg = document.getElementById("noAvailableMessage");

  if (!activeGrid || !availGrid) return;

  // 1) Traer user_courses del usuario
  const { data: userCourses, error: ucError } = await supabase
    .from("user_courses")
    .select("course_id, status, progress_pct, xp_gained")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (ucError) {
    console.error("Error cargando user_courses:", ucError);
  }

  const listUserCourses = userCourses ?? [];
  const courseIds = [...new Set(listUserCourses.map((uc) => uc.course_id).filter(Boolean))];

  // 2) Traer cursos asociados
  let courseMap = new Map();

  if (courseIds.length > 0) {
    const { data: courses, error: cError } = await supabase
      .from("courses")
      .select("id, title, slug, cover_url, category, duration_days, progression_type, xp_reward, active, visibility")
      .in("id", courseIds);

    if (cError) {
      console.error("Error cargando cursos activos:", cError);
    } else if (courses) {
      courses.forEach((c) => courseMap.set(c.id, c));
    }
  }

  // 3) Renderizar cursos activos (status = 'active')
  activeGrid.innerHTML = "";

  const activeCourses = listUserCourses.filter((uc) => uc.status === "active");
  if (activeCourses.length === 0) {
    if (noActiveMsg) noActiveMsg.style.display = "block";
    if (activeCountEl) activeCountEl.textContent = "";
  } else {
    if (noActiveMsg) noActiveMsg.style.display = "none";
    if (activeCountEl) activeCountEl.textContent = `${activeCourses.length} activos`;

    activeCourses.forEach((uc) => {
      const course = courseMap.get(uc.course_id);
      if (!course) return;

      const card = document.createElement("article");
      card.className = "course-card";
      card.onclick = () => {
        if (course.slug) {
          window.location.href = `/curso/index.html?c=${encodeURIComponent(course.slug)}`;
        }
      };

      const progressPct = Number(uc.progress_pct ?? 0);
      const durationDays = course.duration_days ?? null;

      card.innerHTML = `
        <div class="course-cover-wrapper">
          <img
            src="${course.cover_url || "https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=1200"}"
            alt="${course.title || "Curso"}"
            class="course-cover"
          />
        </div>
        <div class="course-body">
          <h3 class="course-title">${course.title}</h3>
          <p class="course-meta">
            ${course.category ? course.category + " · " : ""}${
        durationDays ? `${durationDays} días` : ""
      }
          </p>

          <div class="course-progress-wrapper">
            <div class="course-progress-label">
              <span>Progreso</span>
              <span>${progressPct}%</span>
            </div>
            <div class="course-progress-bar">
              <div class="course-progress-fill" style="width:${progressPct}%;"></div>
            </div>
          </div>

          <div class="course-actions">
            <button class="btn-continue" type="button">Continuar</button>
          </div>
        </div>
      `;

      const btn = card.querySelector(".btn-continue");
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (course.slug) {
            window.location.href = `/curso/index.html?c=${encodeURIComponent(course.slug)}`;
          }
        });
      }

      activeGrid.appendChild(card);
    });
  }

  // 4) Cursos disponibles: activos + públicos que NO están ya en user_courses
  const { data: allCourses, error: allError } = await supabase
    .from("courses")
    .select("id, title, slug, cover_url, category, duration_days, progression_type, xp_reward, active, visibility")
    .eq("active", true)
    .eq("visibility", "public")
    .order("created_at", { ascending: true });

  if (allError) {
    console.error("Error cargando cursos disponibles:", allError);
  }

  const setUserCourseIds = new Set(courseIds);
  const availableCourses = (allCourses ?? []).filter((c) => !setUserCourseIds.has(c.id));

  availGrid.innerHTML = "";

  if (availableCourses.length === 0) {
    if (noAvailableMsg) noAvailableMsg.style.display = "block";
  } else {
    if (noAvailableMsg) noAvailableMsg.style.display = "none";

    availableCourses.forEach((course) => {
      const card = document.createElement("article");
      card.className = "course-card";
      card.onclick = () => {
        if (course.slug) {
          window.location.href = `/curso/index.html?c=${encodeURIComponent(course.slug)}`;
        }
      };

      card.innerHTML = `
        <div class="course-cover-wrapper">
          <img
            src="${course.cover_url || "https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=1200"}"
            alt="${course.title || "Curso"}"
            class="course-cover"
          />
        </div>
        <div class="course-body">
          <h3 class="course-title">${course.title}</h3>
          <p class="course-meta">
            ${course.category ? course.category + " · " : ""}${
        course.duration_days ? `${course.duration_days} días` : ""
      }
          </p>

          <div class="course-tag">
            <span class="dot"></span>
            <span>${
              course.progression_type === "linear" ? "Modo progresivo" : "Modo libre"
            }</span>
          </div>

          <div class="course-actions">
            <button class="btn-continue" type="button">
              Comenzar reto
            </button>
          </div>
        </div>
      `;

      const btn = card.querySelector(".btn-continue");
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (course.slug) {
            window.location.href = `/curso/index.html?c=${encodeURIComponent(course.slug)}`;
          }
        });
      }

      availGrid.appendChild(card);
    });
  }
}

function setupTabBar() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.nav;
      if (target === "dashboard") {
        // Ya estamos aquí
        return;
      }

      // Por ahora NO inventamos rutas nuevas
      // Más adelante podemos mapear:
      // courses -> /mis-cursos/index.html
      // profile -> /perfil/index.html
      // stats   -> /stats/index.html
      alert("Esta sección estará disponible pronto en la nueva versión del panel.");
    });
  });
}

function setupLogout() {
  const btn = document.getElementById("btnLogout");
  if (btn) {
    btn.addEventListener("click", async () => {
      await logout();
    });
  }
}

(async () => {
  // 1) Proteger vista: solo usuario autenticado
  const user = await requireAuth();
  if (!user) return;

  // 2) Header
  await loadHeaderInfo();

  // 3) Gamificación
  await loadGamification(user.id);

  // 4) Cursos
  await loadCourses(user.id);

  // 5) Tab bar + logout
  setupTabBar();
  setupLogout();
})();

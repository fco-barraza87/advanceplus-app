import { supabase } from "/js/supabase.js";
const qs = (sel) => document.querySelector(sel);

/* ==================================================
   1. CARGA DE USUARIO + PROFILE + USER_STATS
================================================== */
async function loadUserData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  const { data: stats } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best, level, xp_prev_level, xp_next_level")
    .eq("user_id", user.id)
    .single();

  return { user, profile, stats };
}

/* ==================================================
   2. HEADER USUARIO
================================================== */
function renderUser(profile) {
  if (!profile) return;

  const nameEl = qs("#userName");
  const roleEl = qs("#userRole");
  const avatarEl = qs("#userAvatar");

  if (nameEl) nameEl.textContent = profile.full_name || "Usuario";

  if (roleEl) {
    roleEl.textContent =
      profile.role === "admin"
        ? "Administrador Advance+"
        : profile.role === "coach"
        ? "Coach Advance+"
        : "Miembro Advance+";
  }

  if (avatarEl && profile.avatar_url) {
    avatarEl.style.backgroundImage = `url(${profile.avatar_url})`;
    avatarEl.style.backgroundSize = "cover";
    avatarEl.style.color = "transparent";
  }
}

/* ==================================================
   3. OBTENER OBJETIVO DE RACHA SEGÚN CURSO ACTIVO
================================================== */
async function getStreakGoal(userId) {
  const { data: active } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);

  if (!active || !active.length) return 21;

  const { data: course } = await supabase
    .from("courses")
    .select("duration_days")
    .eq("id", active[0].course_id)
    .single();

  return course?.duration_days ?? 21;
}

/* ==================================================
   4. GAMIFICACIÓN — NIVELES + XP + RACHA DINÁMICA
================================================== */
async function renderGamification(stats, userId) {
  if (!stats) return;

  /* ------------------------------
     RACHA
  --------------------------------*/
  const streak = stats.streak_current ?? 0;
  const best = stats.streak_best ?? 0;

  const goalDays = await getStreakGoal(userId);
  const pctRacha = Math.min(100, (streak / goalDays) * 100);

  qs("#streakCurrent").textContent = streak;
  qs("#streakBest").textContent = best;
  qs("#streakGoalLabel").textContent = `Objetivo: ${goalDays} días`;

  const rachaBar = qs("#streakBarFill");
  if (rachaBar) {
    setTimeout(() => (rachaBar.style.width = pctRacha + "%"), 150);
  }

  /* ------------------------------
     NIVEL + XP (DINÁMICO)
  --------------------------------*/

  const xp = stats.xp_total ?? 0;

  // 1) Intentar leer fórmula desde la DB
  const xpPrev = stats.xp_prev_level;
  const xpNext = stats.xp_next_level;

  let xpUsed, xpNeeded, level;

  if (
    typeof xpPrev === "number" &&
    typeof xpNext === "number" &&
    stats.level
  ) {
    /* --- ✔️ USAR VALORES DE LA DB (preferido) --- */
    level = stats.level;
    xpUsed = xpPrev;
    xpNeeded = xpNext;

  } else {
    /* --- ⚠️ FALLBACK LOCAL (tu fórmula antigua) --- */
    const base = 100;
    const growth = 1.35;
    const xpForLevel = (lvl) => Math.round(base * growth ** (lvl - 1));

    level = 1;
    xpUsed = 0;
    xpNeeded = xpForLevel(1);

    while (xp >= xpUsed + xpNeeded) {
      xpUsed += xpNeeded;
      level++;
      xpNeeded = xpForLevel(level);
    }
  }

  // Cálculo final
  const xpIntoLevel = xp - xpUsed;
  const pctXP = Math.min(100, (xpIntoLevel / xpNeeded) * 100);

  qs("#userLevel").textContent = level;
  qs("#xpThisLevel").textContent = `${xpIntoLevel} / ${xpNeeded} XP`;
  qs("#nextLevel").textContent = `Siguiente: Nivel ${level + 1}`;

  const xpBar = qs("#xpFill");
  if (xpBar) {
    setTimeout(() => (xpBar.style.width = pctXP + "%"), 200);
  }
}

/* ==================================================
   5. RETOS ACTIVOS
================================================== */
async function loadActiveCourses(userId) {
  const { data: userCourses } = await supabase
    .from("user_courses")
    .select("course_id, status, started_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  const list = [];

  for (const uc of userCourses || []) {
    const { data: course } = await supabase
      .from("courses")
      .select("id, title, slug, cover_url, category, level, duration_days, active")
      .eq("id", uc.course_id)
      .single();

    if (course?.active) list.push(course);
  }

  return list;
}

function renderActiveCourses(courses, user) {
  const grid = qs("#activeCoursesGrid");
  const empty = qs("#noActiveMessage");
  const count = qs("#activeCount");

  grid.innerHTML = "";

  if (!courses.length) {
    empty.style.display = "block";
    count.textContent = "";
    return;
  }

  empty.style.display = "none";
  count.textContent = `${courses.length} activos`;

  courses.forEach((course) => {
    const cover = course.cover_url || "https://via.placeholder.com/600x300.png?text=A+";

    const card = document.createElement("article");
    card.className = "course-card clickable";
    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover" />
        <span class="course-badge">${course.category}</span>
      </div>

      <div class="course-body">
        <div class="course-title">${course.title}</div>
        <div class="course-meta">${course.level || "Todos los niveles"}</div>
      </div>
    `;

    card.onclick = async () => {
      const { data: progress } = await supabase
        .from("progress")
        .select("day, completed")
        .eq("user_id", user.id)
        .eq("course_id", course.id)
        .order("day");

      let nextDay = 1;

      if (progress?.length) {
        const done = progress.filter((p) => p.completed);
        if (done.length) nextDay = done.at(-1).day + 1;
      }

      if (nextDay > course.duration_days) nextDay = course.duration_days;

      window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
    };

    grid.appendChild(card);
  });
}

/* ==================================================
   6. EXPLORAR RETOS
================================================== */
async function loadAvailableCourses(userId) {
  const { data: all } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  const { data: mine } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  const owned = new Set((mine || []).map((c) => c.course_id));

  return all.filter((c) => !owned.has(c.id));
}

function renderAvailableCourses(courses) {
  const grid = qs("#availableCoursesGrid");
  const empty = qs("#noAvailableMessage");

  grid.innerHTML = "";

  if (!courses.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  courses.forEach((course) => {
    const cover = course.cover_url || "https://via.placeholder.com/600x300.png?text=A+";

    const card = document.createElement("div");
    card.className = "course-card clickable";
    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover" />
        <span class="course-badge">${course.category}</span>
      </div>

      <div class="course-body">
        <div class="course-title">${course.title}</div>
        <div class="course-meta">${course.level}</div>
      </div>
    `;

    card.onclick = () => {
      window.location.href = `/curso-info/index.html?c=${course.id}`;
    };

    grid.appendChild(card);
  });
}

/* ==================================================
   7. MISIÓN DEL DÍA
================================================== */
async function loadMission(user) {
  const { data: active } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  const card = qs("#missionCard");

  if (!active?.length) {
    card.style.display = "none";
    return;
  }

  const courseId = active[0].course_id;

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  const { data: progress } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .order("day");

  let nextDay = 1;
  if (progress?.length) {
    const done = progress.filter((p) => p.completed);
    if (done.length) nextDay = done.at(-1).day + 1;
  }

  if (nextDay > course.duration_days) nextDay = course.duration_days;

  qs("#missionTitle").textContent = course.mission_title || "Misión del día";
  qs("#missionDesc").textContent = course.mission_desc || "Toma el control de tu día.";
  qs("#missionMeta").textContent = `${course.title} · Día ${nextDay} · ${course.category}`;

  qs("#missionBtn").onclick = () => {
    window.location.href = `/curso/index.html?c=${courseId}&day=${nextDay}`;
  };

  card.style.display = "flex";
}

/* ==================================================
   8. LOGOUT
================================================== */
function setupLogout() {
  qs("#btnLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

/* ==================================================
   9. INIT
================================================== */
async function initDashboard() {
  setupLogout();

  const data = await loadUserData();
  if (!data) return;

  const { user, profile, stats } = data;

  renderUser(profile);

  // 🎯 racha + nivel + barras dinámicas (DB-first)
  await renderGamification(stats, user.id);

  const active = await loadActiveCourses(user.id);
  renderActiveCourses(active, user);

  const available = await loadAvailableCourses(user.id);
  renderAvailableCourses(available);

  await loadMission(user);
}

initDashboard();

// /js/dashboard-user.js
import { supabase } from "/js/supabase.js";

const qs = (sel) => document.querySelector(sel);

/* ==================================================
   1. CARGA DE USUARIO + PROFILE + USER_STATS
================================================== */
async function loadUserData() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Perfil básico + métricas de respaldo
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, xp_total, streak_current, streak_best")
    .eq("id", user.id)
    .single();

  // Stats avanzadas (si existe user_stats)
  const { data: stats } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best, level, xp_prev_level, xp_next_level")
    .eq("user_id", user.id)
    .single();

  return { user, profile, stats };
}

/* ==================================================
   2. OBJETIVO DE RACHA SEGÚN CURSO ACTIVO
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
   3. GAMIFICACIÓN — NIVELES + XP + RACHA
================================================== */
async function renderGamification(stats, profile, userId) {
  // Fallback: si no hay user_stats, usamos profiles
  const xpTotal = stats?.xp_total ?? profile?.xp_total ?? 0;
  const streak = stats?.streak_current ?? profile?.streak_current ?? 0;
  const best = stats?.streak_best ?? profile?.streak_best ?? 0;

  /* ---------- RACHA ---------- */
  const goalDays = await getStreakGoal(userId);
  const pctRacha = Math.min(100, goalDays > 0 ? (streak / goalDays) * 100 : 0);

  const streakCurrentEl = qs("#streakCurrent");
  const streakBestEl = qs("#streakBest");
  const streakGoalLabelEl = qs("#streakGoalLabel");
  const rachaBar = qs("#streakBarFill");

  if (streakCurrentEl) streakCurrentEl.textContent = streak;
  if (streakBestEl) streakBestEl.textContent = best;
  if (streakGoalLabelEl) streakGoalLabelEl.textContent = `Objetivo: ${goalDays} días`;

  if (rachaBar) {
    setTimeout(() => {
      rachaBar.style.width = pctRacha + "%";
    }, 150);
  }

  /* ---------- NIVEL + XP ---------- */
  let xpPrev = stats?.xp_prev_level;
  let xpNext = stats?.xp_next_level;
  let level = stats?.level;

  if (
    typeof xpPrev === "number" &&
    typeof xpNext === "number" &&
    typeof level === "number"
  ) {
    // usamos los valores calculados en la DB (user_stats)
  } else {
    // fallback local: fórmula
    const base = 100;
    const growth = 1.35;
    const xpForLevel = (lvl) => Math.round(base * Math.pow(growth, lvl - 1));

    level = 1;
    let xpReq = xpForLevel(1);

    while (xpTotal >= xpReq) {
      level++;
      xpReq = xpForLevel(level);
    }

    xpNext = xpReq;
  }

  const pctXP = Math.min(100, xpNext > 0 ? (xpTotal / xpNext) * 100 : 0);

  const levelEl = qs("#userLevel");
  const xpThisLevelEl = qs("#xpThisLevel");
  const nextLevelEl = qs("#nextLevel");
  const xpBar = qs("#xpFill");

  if (levelEl) levelEl.textContent = level ?? 1;
  if (xpThisLevelEl) xpThisLevelEl.textContent = `${xpTotal} / ${xpNext || 0} XP`;
  if (nextLevelEl) nextLevelEl.textContent = `Siguiente: Nivel ${(level || 1) + 1}`;

  if (xpBar) {
    setTimeout(() => {
      xpBar.style.width = pctXP + "%";
    }, 150);
  }
}

/* ==================================================
   CURSOS ACTIVOS (VERSIÓN CORRECTA)
==================================================== */

/**
 * Obtiene TODOS los cursos activos del usuario.
 * NO filtra por "active" en la tabla courses,
 * porque si el usuario lo tiene activo → debe mostrarse igual.
 */
async function loadActiveCourses(userId) {
  const { data: active } = await supabase
    .from("user_courses")
    .select("course_id, status, started_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: true });

  if (!active) return [];

  const list = [];

  for (const uc of active) {
    const { data: course } = await supabase
      .from("courses")
      .select("*")
      .eq("id", uc.course_id)
      .single();

    if (course) list.push(course);
  }

  return list;
}

/**
 * Cálculo EXACTO del siguiente día basado en progress:
 * nextDay = primer day donde completed = false
 */
async function getNextLesson(userId, courseId, durationDays) {
  const { data: progress } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("day");

  if (!progress || progress.length === 0) return 1;

  // Buscar primer día incompleto
  const firstIncomplete = progress.find(p => p.completed === false);

  if (firstIncomplete) return firstIncomplete.day;

  // Si todos están completos → devolver último día
  return durationDays;
}


/**
 * Renderiza todos los cursos activos correctamente
 */
function renderActiveCourses(courses, user) {
  const carousel = qs("#activeChallengesCarousel");
  const empty = qs("#noActiveChallenges");
  const count = qs("#activeChallengesCount");

  if (!carousel) return;

  carousel.innerHTML = "";

  if (!courses.length) {
    empty.style.display = "block";
    count.textContent = "0 activos";
    return;
  }

  empty.style.display = "none";
  count.textContent = `${courses.length} activo${courses.length > 1 ? "s" : ""}`;

  courses.forEach((course) => {
    const cover = course.cover_url || "/img/default-cover.png";

    const card = document.createElement("article");
    card.className = "course-card clickable carousel-item";
    card.innerHTML = `
      <div class="course-cover">
        <img src="${cover}" alt="${course.title}" />
      </div>

      <div class="course-title">${course.title}</div>
      <div class="course-meta">${course.level || "Todos los niveles"}</div>
      <div class="course-day">Duración: ${course.duration_days || "—"} días</div>
    `;

    // Al hacer clic → ir a siguiente lección REAL
    card.onclick = async () => {
      const nextDay = await getNextLesson(
        user.id,
        course.id,
        course.duration_days
      );

      window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
    };

    carousel.appendChild(card);
  });
}

/* ==================================================
   5. EXPLORAR RETOS
================================================== */
async function loadAvailableCourses(userId) {
  const { data: all } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      short_promise,
      hero_image_url,
      thumbnail_url,
      badge_text,
      price_chf,
      sale_price_chf,
      reviews_average,
      reviews_count,
      active
    `)
    .eq("active", true);

  const { data: mine } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  const owned = new Set((mine || []).map((c) => c.course_id));

  return (all || []).filter((c) => !owned.has(c.id));
}

function renderPremiumCourseCard(course) {
  const card = document.createElement("article");
  card.className = "course-card premium-course-card";

  const hero =
    course.hero_image_url ||
    course.thumbnail_url ||
    "https://via.placeholder.com/600x300?text=A+";

  card.innerHTML = `
    <div class="course-cover" style="background-image:url('${hero}');background-size:cover;background-position:center;"></div>
    <div class="course-title">${course.title}</div>
    <p class="course-desc">${course.short_promise || ""}</p>
    <div class="course-meta-row">
      ${
        course.badge_text
          ? `<span class="course-pill">${course.badge_text}</span>`
          : ""
      }
      <span class="course-pill">
        ⭐ ${course.reviews_average || "5.0"} · ${course.reviews_count || 0} reseñas
      </span>
    </div>
    <div class="course-price">
      ${
        course.sale_price_chf
          ? `<del>${course.price_chf} CHF</del> ${course.sale_price_chf} CHF`
          : `${course.price_chf || 0} CHF`
      }
    </div>
    <button class="course-btn">Ver reto →</button>
  `;

  card.onclick = () => {
    // Más adelante podemos crear una página de detalle.
    window.location.href = `/curso/index.html?c=${course.id}`;
  };

  return card;
}

function renderAvailableCourses(courses) {
  const grid = qs("#coursesGrid");
  const empty = qs("#noAvailableMessage");

  if (!grid || !empty) return;

  grid.innerHTML = "";

  if (!courses.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  courses.forEach((course) => {
    const card = renderPremiumCourseCard(course);
    grid.appendChild(card);
  });
}

/* ==================================================
   MISIÓN DEL DÍA (CORREGIDA)
==================================================== */
async function loadMission(user) {
  const card = qs("#missionCard");
  const promoCard = qs("#missionPromoCard");
  const promoBtn = qs("#missionPromoBtn");

  const { data: activeUserCourses } = await supabase
    .from("user_courses")
    .select("course_id, started_at, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: true });

  if (!activeUserCourses?.length) {
    // No tiene cursos → mostrar promo
    card.style.display = "none";
    promoCard.style.display = "flex";
    promoBtn.onclick = () => window.location.href = "/curso/index.html";
    return;
  }

  // Seleccionar el primer curso activo (el más antiguo)
  const chosen = activeUserCourses[0];

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", chosen.course_id)
    .single();

  if (!course) return;

  const nextDay = await getNextLesson(
    user.id,
    course.id,
    course.duration_days
  );

  // COMPLETADO → mostrar promo
  if (nextDay > course.duration_days) {
    card.style.display = "none";
    promoCard.style.display = "flex";
    promoBtn.onclick = () => window.location.href = "/curso/index.html";
    return;
  }

  // Mostrar misión real
  card.style.display = "flex";
  promoCard.style.display = "none";

  qs("#missionTitle").textContent =
    course.mission_title || "Misión del día";

  qs("#missionDesc").textContent =
    course.mission_desc || "Toma el control de tu día con esta acción clave.";

  qs("#missionMeta").textContent =
    `${course.title} · Día ${nextDay}`;

  qs("#missionBtn").onclick = () => {
    window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
  };
}


/* ==================================================
   7. COACH IA – MENSAJE DEL DÍA
================================================== */
async function loadRandomCoachMessage() {
  const textEl = qs("#coachMessageText");
  const styleEl = qs("#coachMessageStyle");
  const timeEl = qs("#coachMessageTime");
  const cardEl = qs("#coachMessageCard");
  const emptyEl = qs("#coachMessageEmpty");

  const { data, error } = await supabase
    .from("coach_messages_library")
    .select("message, style")
    .eq("active", true);

  if (error || !data || !data.length) {
    if (cardEl) cardEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }

  const random = data[Math.floor(Math.random() * data.length)];

  if (textEl) textEl.textContent = random.message;
  if (styleEl) styleEl.textContent = `Estilo: ${random.style}`;
  if (timeEl) timeEl.textContent = "Mensaje del día";

  if (emptyEl) emptyEl.style.display = "none";
  if (cardEl) cardEl.style.display = "block";
}

/* ==================================================
   8. INIT DASHBOARD
================================================== */
async function initDashboard() {
  const data = await loadUserData();
  if (!data) return;

  const { user, profile, stats } = data;

  await renderGamification(stats, profile, user.id);

  const active = await loadActiveCourses(user.id);
  renderActiveCourses(active, user);

  const available = await loadAvailableCourses(user.id);
  renderAvailableCourses(available);

  await loadMission(user);
  await loadRandomCoachMessage();
}

initDashboard();

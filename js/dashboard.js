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
   2. HEADER USUARIO (usa elementos del header global)
================================================== */
function renderUser(profile) {
  if (!profile) return;

  const nameEl = qs("#headerUserName");  // en user-header.js
  const roleEl = qs("#headerUserRole");
  const avatarEl = qs("#headerUserAvatar");

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
    avatarEl.textContent = "";
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

  /* ------------------------------
     NIVEL + XP (DINÁMICO)
  --------------------------------*/
  const xpTotal = stats.xp_total ?? 0;

  let xpPrev = stats.xp_prev_level;
  let xpNext = stats.xp_next_level;
  let level = stats.level;

  if (
    typeof xpPrev === "number" &&
    typeof xpNext === "number" &&
    typeof level === "number"
  ) {
    // usamos los valores calculados en la DB
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
   5. RETOS ACTIVOS (CARRUSEL)
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
  const carousel = qs("#activeChallengesCarousel");
  const empty = qs("#noActiveChallenges");
  const count = qs("#activeChallengesCount");

  if (!carousel || !empty || !count) return;

  carousel.innerHTML = "";

  if (!courses.length) {
    empty.style.display = "block";
    count.textContent = "0 activos";
    return;
  }

  empty.style.display = "none";
  count.textContent = `${courses.length} activo${courses.length > 1 ? "s" : ""}`;

  courses.forEach((course) => {
    const cover = course.cover_url || "https://via.placeholder.com/600x300.png?text=A+";

    const card = document.createElement("article");
    card.className = "course-card clickable carousel-item";
    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover" alt="${course.title}" />
        <span class="course-badge">${course.category || "Reto"}</span>
      </div>
      <div class="course-body">
        <div class="course-title">${course.title}</div>
        <div class="course-meta">${course.level || "Todos los niveles"}</div>
        <div class="course-day">Duración: ${course.duration_days || "—"} días</div>
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

      if (nextDay > (course.duration_days || 1)) {
        nextDay = course.duration_days || 1;
      }

      window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
    };

    carousel.appendChild(card);
  });
}

/* ==================================================
   6. EXPLORAR RETOS
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
  card.className = "course-card-premium";

  const hero =
    course.hero_image_url ||
    course.thumbnail_url ||
    "https://via.placeholder.com/600x300?text=A+";

  card.innerHTML = `
    <div class="card-bg" style="background-image: url('${hero}')"></div>
    <div class="card-content">
      ${course.badge_text ? `<div class="card-badge">${course.badge_text}</div>` : ""}
      <h3 class="card-title">${course.title}</h3>
      <p class="card-promise">${course.short_promise || ""}</p>
      <div class="card-rating">
        ⭐ ${course.reviews_average || "5.0"} · ${course.reviews_count || 0} reseñas
      </div>
      <div class="card-price">
        ${
          course.sale_price_chf
            ? `<del>${course.price_chf} CHF</del> ${course.sale_price_chf} CHF`
            : `${course.price_chf || 0} CHF`
        }
      </div>
      <div class="card-btn">Ver reto →</div>
    </div>
  `;

  card.onclick = () => {
    window.location.href = `/curso-info.html?id=${course.id}`;
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
   7. MISIÓN DEL DÍA
================================================== */
async function loadMission(user) {
  const card = qs("#missionCard");
  const promoCard = qs("#missionPromoCard");

  if (!card || !promoCard) return;

  // 1. Curso activo más reciente
  const { data: active } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  // Si NO tiene cursos activos → promo directa
  if (!active?.length) {
    card.style.display = "none";
    promoCard.style.display = "flex";

    const promoBtn = qs("#missionPromoBtn");
    if (promoBtn) {
      promoBtn.onclick = () => (window.location.href = "/perfil/cursos.html");
    }
    return;
  }

  const courseId = active[0].course_id;

  // 2. Datos del curso
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) {
    card.style.display = "none";
    promoCard.style.display = "flex";
    return;
  }

  // 3. Progreso del curso
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

  // 4. Si ya completó todo el curso…
  if (nextDay > (course.duration_days || 1)) {
    const { data: available } = await supabase
      .from("courses")
      .select("id")
      .eq("active", true)
      .neq("id", courseId);

    const promoBtn = qs("#missionPromoBtn");

    card.style.display = "none";
    promoCard.style.display = "flex";

    if (available?.length) {
      if (promoBtn) {
        promoBtn.textContent = "Ver más retos";
        promoBtn.onclick = () => (window.location.href = "/perfil/cursos.html");
      }
    } else {
      const promoDesc = promoCard.querySelector(".mission-desc");
      if (promoDesc) {
        promoDesc.textContent =
          "Has completado todos los cursos disponibles. Nuevos retos A+ llegarán muy pronto.";
      }
      if (promoBtn) {
        promoBtn.textContent = "Volver al inicio";
        promoBtn.onclick = () => (window.location.href = "/dashboard/index.html");
      }
    }

    return;
  }

  // 5. Curso aún en progreso → misión normal
  const titleEl = qs("#missionTitle");
  const descEl = qs("#missionDesc");
  const metaEl = qs("#missionMeta");
  const btnEl = qs("#missionBtn");

  if (titleEl) titleEl.textContent = course.mission_title || "Misión del día";
  if (descEl)
    descEl.textContent =
      course.mission_desc || "Toma el control de tu día con esta acción clave.";
  if (metaEl)
    metaEl.textContent = `${course.title} · Día ${nextDay} · ${
      course.category || "Reto"
    }`;

  if (btnEl) {
    btnEl.onclick = () => {
      window.location.href = `/curso/index.html?c=${courseId}&day=${nextDay}`;
    };
  }

  promoCard.style.display = "none";
  card.style.display = "flex";
}

/* ==================================================
   8. COACH IA – MENSAJE ALEATORIO
================================================== */
async function loadRandomCoachMessage() {
  const { data, error } = await supabase
    .from("coach_messages_library")
    .select("message, style")
    .eq("active", true);

  if (error || !data || !data.length) {
    console.warn("No hay mensajes de coach IA o error", error);
    return;
  }

  const random = data[Math.floor(Math.random() * data.length)];

  const textEl = qs("#coachMessageText");
  const styleEl = qs("#coachMessageStyle");
  const timeEl = qs("#coachMessageTime");
  const cardEl = qs("#coachMessageCard");

  if (textEl) textEl.textContent = random.message;
  if (styleEl) styleEl.textContent = `Estilo: ${random.style}`;
  if (timeEl) timeEl.textContent = "Mensaje del día";

  if (cardEl) cardEl.style.display = "block";
}

/* ==================================================
   9. INIT DASHBOARD
================================================== */
async function initDashboard() {
  const data = await loadUserData();
  if (!data) return;

  const { user, profile, stats } = data;

  renderUser(profile);
  await renderGamification(stats, user.id);

  const active = await loadActiveCourses(user.id);
  renderActiveCourses(active, user);

  const available = await loadAvailableCourses(user.id);
  renderAvailableCourses(available);

  await loadMission(user);
  await loadRandomCoachMessage();
}

initDashboard();

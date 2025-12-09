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
   4. RETOS ACTIVOS (CARRUSEL)
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
    const cover =
      course.cover_url || "https://via.placeholder.com/600x300.png?text=A+";

    const card = document.createElement("article");
    card.className = "course-card clickable carousel-item";
    card.innerHTML = `
      <div class="course-cover">
        <img src="${cover}" alt="${course.title}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />
      </div>
      <div class="course-title">${course.title}</div>
      <div class="course-meta">${course.level || "Todos los niveles"}</div>
      <div class="course-day">Duración: ${course.duration_days || "—"} días</div>
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

      window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
    };

    carousel.appendChild(card);
  });
}

/* ==================================================
   5. EXPLORAR RETOS — VERSIÓN AVANZADA INTEGRADA
================================================== */

// 5.0 — Helper para inscribir cursos gratis
async function enrollFreeCourse(userId, courseId) {
  const { error } = await supabase.from("user_courses").insert({
    user_id: userId,
    course_id: courseId,
    status: "active",
    payment_status: "free",
    source: "dashboard_explore"
  });

  if (error) {
    console.error("[dashboard] Error inscribiendo curso gratis:", error);
    throw error;
  }
}

// 5.1 — Calcula el estado correcto del curso para pintar la card
function getCourseExploreState(course, userCourse) {
  const isPaid = !!course.is_paid;
  const isComingSoon = !course.active || !course.is_active;
  const hasCheckout = !!course.systeme_checkout_url;
  const activeUser = userCourse?.status === "active";

  // Ya inscrito → no mostrar en explorar
  if (activeUser) return { show: false };

  // Próximamente
  if (isComingSoon) {
    return {
      show: true,
      type: "coming_soon",
      badge: "Próximamente",
      badgeClass: "explore-badge-soon",
      btnText: "Más información",
      action: "prelaunch"
    };
  }

  // Pagado
  if (isPaid) {
    if (!userCourse) {
      return {
        show: true,
        type: "paid_locked",
        badge: "Premium",
        badgeClass: "explore-badge-paid",
        btnText: "Comprar",
        action: "checkout"
      };
    }
  }

  // Gratis no inscrito
  if (!isPaid && !userCourse) {
    return {
      show: true,
      type: "free_available",
      badge: "Gratis",
      badgeClass: "explore-badge-free",
      btnText: "Empezar gratis",
      action: "start_free"
    };
  }

  return { show: false };
}

// 5.2 — Carga avanzada de cursos disponibles
async function loadExploreCourses(user) {
  const grid = qs("#coursesGrid"); // usa tu ID actual
  const empty = qs("#noAvailableMessage");
  if (!grid || !empty) return;

  grid.innerHTML = "";
  empty.style.display = "none";

  const userId = user.id;

  // Cursos del usuario
  const { data: userCourses } = await supabase
    .from("user_courses")
    .select("course_id, status, payment_status");

  const owned = new Map();
  (userCourses || []).forEach((uc) => owned.set(uc.course_id, uc));

  // Cursos disponibles
  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !courses) {
    empty.style.display = "block";
    empty.textContent = "No se pudieron cargar los retos.";
    return;
  }

  const cards = [];

  courses.forEach((course) => {
    const userCourse = owned.get(course.id);
    const state = getCourseExploreState(course, userCourse);

    if (!state.show) return;

    const priceMain = course.sale_price_chf ?? course.price_chf;
    const priceOld = course.sale_price_chf ? course.price_chf : null;

    const hero =
      course.hero_image_url ||
      course.thumbnail_url ||
      "https://via.placeholder.com/600x300?text=A+";

    const card = document.createElement("article");
    card.className = "course-card premium-course-card";

    card.innerHTML = `
      <div class="course-cover" style="background-image:url('${hero}')"></div>
      <div class="course-title">${course.title}</div>
      <p class="course-desc">${course.short_promise || course.subtitle || ""}</p>

      <div class="course-meta-row">
        <span class="course-pill">${course.category}</span>
        ${
          state.badge
            ? `<span class="course-pill ${state.badgeClass}">${state.badge}</span>`
            : ""
        }
      </div>

      <div class="course-price">
        ${
          !course.is_paid
            ? `<span class="explore-price-free">Gratis</span>`
            : priceOld
            ? `<del>${priceOld} CHF</del> <strong>${priceMain} CHF</strong>`
            : `<strong>${priceMain} CHF</strong>`
        }
      </div>

      <button class="course-btn">${state.btnText}</button>
    `;

    const btn = card.querySelector(".course-btn");

    btn.onclick = async () => {
      try {
        switch (state.action) {
          case "start_free":
            await enrollFreeCourse(userId, course.id);
            window.location.href = `/curso/index.html?c=${course.id}`;
            break;

          case "checkout":
            window.location.href = course.systeme_checkout_url;
            break;

          case "prelaunch":
            window.location.href = `/retos/${course.slug}.html`;
            break;
        }
      } catch (err) {
        console.error("Error ejecutando acción Explore:", err);
      }
    };

    cards.push(card);
  });

  if (!cards.length) {
    empty.style.display = "block";
    empty.textContent = "Pronto añadiremos nuevos retos.";
    return;
  }

  cards.forEach((c) => grid.appendChild(c));
}


/* funcion 6?? */

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
   6. MISIÓN DEL DÍA
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

  const promoBtn = qs("#missionPromoBtn");

  // Si NO tiene cursos activos → promo directa
  if (!active?.length) {
    card.style.display = "none";
    promoCard.style.display = "flex";

    if (promoBtn) {
      promoBtn.textContent = "Ver retos disponibles";
      promoBtn.onclick = () => (window.location.href = "/curso/index.html");
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
    if (promoBtn) {
      promoBtn.textContent = "Ver retos disponibles";
      promoBtn.onclick = () => (window.location.href = "/curso/index.html");
    }
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

    card.style.display = "none";
    promoCard.style.display = "flex";

    if (available?.length) {
      if (promoBtn) {
        promoBtn.textContent = "Ver más retos";
        promoBtn.onclick = () => (window.location.href = "/curso/index.html");
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
      course.mission_desc ||
      "Toma el control de tu día con esta acción clave.";
  if (metaEl)
    metaEl.textContent = `${course.title} · Día ${nextDay} · ${
      course.category || "Reto"
    }`;

  if (btnEl) {
    btnEl.onclick = () => {
      window.location.href = `/curso/lesson.html?c=${course.id}&day=${nextDay}`;
    };
  }

  promoCard.style.display = "none";
  card.style.display = "flex";
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

  
  await loadExploreCourses(user);

  await loadMission(user);
  await loadRandomCoachMessage();
}

initDashboard();

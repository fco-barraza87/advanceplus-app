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

const xpTotal = stats.xp_total ?? 0;

// Intentar leer desde la DB
const xpPrev = stats.xp_prev_level;
const xpNext = stats.xp_next_level;
let level = stats.level;

// Si la DB devolvió nivel + prev/next → usar eso
if (
  typeof xpPrev === "number" &&
  typeof xpNext === "number" &&
  typeof level === "number"
) {
  // xpNext = XP requerido para llegar al próximo nivel
  // xpTotal = XP acumulado por el usuario
} else {
  // --- FALLBACK LOCAL SI FALTA ALGO ---
  const base = 100;
  const growth = 1.35;
  const xpForLevel = lvl => Math.round(base * Math.pow(growth, lvl - 1));

  level = 1;
  let xpReq = xpForLevel(1);

  while (xpTotal >= xpReq) {
    level++;
    xpReq = xpForLevel(level);
  }

  // fallback: xpNext = requerido para este nivel
  xpNext = xpReq;
}

// Porcentaje real basado en XP TOTAL
const pctXP = Math.min(100, (xpTotal / xpNext) * 100);

// Render en pantalla
qs("#userLevel").textContent = level;
qs("#xpThisLevel").textContent = `${xpTotal} / ${xpNext} XP`;
qs("#nextLevel").textContent = `Siguiente: Nivel ${level + 1}`;

// Animación barra
const xpBar = qs("#xpFill");
if (xpBar) {
  setTimeout(() => {
    xpBar.style.width = pctXP + "%";
  }, 150);
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

  return all.filter((c) => !owned.has(c.id));
}


/* ============================================================
   TARJETA PREMIUM — MASTERCLASS + MINDVALLEY
============================================================ */

function renderPremiumCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card-premium";

  const hero = course.hero_image_url || course.thumbnail_url || "https://via.placeholder.com/600x300?text=A+";

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
  const grid = qs("#availableCoursesGrid");
  const empty = qs("#noAvailableMessage");

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
   7. MISIÓN DEL DÍA (con oferta si ya no quedan cursos)
================================================== */
async function loadMission(user) {
  const card = qs("#missionCard");
  const promoCard = qs("#missionPromoCard");

  // 1. Buscar curso activo más reciente
  const { data: active } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  // Si NO tiene cursos activos → mostrar promoción directamente
  if (!active?.length) {
    card.style.display = "none";
    promoCard.style.display = "flex";

    qs("#missionPromoBtn").onclick = () =>
      (window.location.href = "/cursos/index.html");

    return;
  }

  const courseId = active[0].course_id;

  // 2. Datos del curso
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

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
  if (nextDay > course.duration_days) {
    // ¿Existen cursos nuevos disponibles?
    const { data: available } = await supabase
      .from("courses")
      .select("id")
      .eq("active", true)
      .neq("id", courseId);

    // SI existen cursos → promoción de continuar
    if (available?.length) {
      card.style.display = "none";
      promoCard.style.display = "flex";

      qs("#missionPromoBtn").onclick = () =>
        (window.location.href = "/cursos/index.html");

      return;
    }

    // SI NO existen cursos → mensaje de “próximamente”
    card.style.display = "none";
    promoCard.style.display = "flex";

    qs("#missionPromoCard .mission-desc").textContent =
      "Has completado todos los cursos disponibles. Nuevos retos A+ llegarán muy pronto.";

    qs("#missionPromoBtn").textContent = "Volver al inicio";
    qs("#missionPromoBtn").onclick = () =>
      (window.location.href = "/dashboard/index.html");

    return;
  }

  // 5. Si el curso aún NO termina → misión normal
  qs("#missionTitle").textContent = course.mission_title || "Misión del día";
  qs("#missionDesc").textContent = course.mission_desc || "Toma el control de tu día.";
  qs("#missionMeta").textContent = `${course.title} · Día ${nextDay} · ${course.category}`;

  qs("#missionBtn").onclick = () => {
    window.location.href = `/curso/index.html?c=${courseId}&day=${nextDay}`;
  };

  promoCard.style.display = "none";
  card.style.display = "flex";
}


/* ==================================================
   8. LOGOUT
================================================== */


/* ==================================================
   9. INIT
================================================== */
async function initDashboard() {


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
  await loadRandomCoachMessage();
}

/* ==================================================
   COACH IA – MENSAJE ALEATORIO DESDE LA LIBRERÍA
================================================== */
async function loadRandomCoachMessage() {
  const { data, error } = await supabase
    .from("coach_messages_library")
    .select("message, style")
    .eq("active", true);

  if (error || !data || !data.length) {
    console.warn("No hay mensajes de coach IA o error");
    return;
  }

  // Elegir un mensaje aleatorio
  const random = data[Math.floor(Math.random() * data.length)];

  qs("#coachMessageText").textContent = random.message;
  qs("#coachMessageStyle").textContent = `Estilo: ${random.style}`;
  qs("#coachMessageTime").textContent = "Mensaje del día";

  // Mostrar tarjeta
  qs("#coachMessageCard").style.display = "block";
}

async function loadCoachMessage(userId) {
  // 1) Último mensaje visto
  const lastSeen = await getLastSeenMessage(userId);

  // 2) Elegir un nuevo mensaje aleatorio distinto
  const msg = await getRandomCoachMessage(lastSeen);

  if (!msg) return;

  // 3) Mostrar en dashboard
  const display = document.querySelector("#coachMessage");
  if (display) display.textContent = msg.message;

  // 4) Guardar historial
  await saveMessageHistory(userId, msg.id);
}


async function getLastSeenMessage(userId) {
  const { data, error } = await supabase
    .from("coach_messages_history")
    .select("message_id")
    .eq("user_id", userId)
    .order("seen_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error obteniendo historial:", error);
    return null;
  }

  return data?.length ? data[0].message_id : null;
}

async function getRandomCoachMessage(excludeId = null) {
  const { data, error } = await supabase
    .from("coach_messages_library")
    .select("id, message, style");

  if (error || !data) {
    console.error("Error cargando mensajes coach:", error);
    return null;
  }

  let pool = data;

  // Excluir último mensaje
  if (excludeId) {
    pool = data.filter((m) => m.id !== excludeId);
  }

  if (!pool.length) return data[0];

  // Random
  const random = pool[Math.floor(Math.random() * pool.length)];

  return random;
}

async function saveMessageHistory(userId, messageId) {
  const { error } = await supabase
    .from("coach_messages_history")
    .insert({
      user_id: userId,
      message_id: messageId
    });

  if (error) console.error("Error guardando historial coach:", error);
}


initDashboard();

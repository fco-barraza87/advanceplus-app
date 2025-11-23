import { supabase } from "/js/supabase.js";

const qs = (sel) => document.querySelector(sel);

/* ==================================================
   1. CARGA DE USUARIO + PROFILE + USER_STATS
================================================== */
async function loadUserData() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Perfil básico
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  if (pErr) {
    console.error("Error cargando profile:", pErr);
  }

  // Stats oficiales (XP, rachas, nivel)
  const { data: stats, error: sErr } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best, level")
    .eq("user_id", user.id)
    .single();

  if (sErr) {
    console.error("Error cargando user_stats:", sErr);
  }

  return { user, profile, stats };
}

/* ==================================================
   2. HEADER USUARIO
================================================== */
function renderUser(profile) {
  if (!profile) return;

  const nameEl = qs("#userName");
  const roleEl = qs("#userRole");
  const avatar = qs("#userAvatar");

  if (nameEl) nameEl.textContent = profile.full_name || "Usuario";

  if (roleEl) {
    roleEl.textContent =
      profile.role === "admin"
        ? "Administrador Advance+"
        : profile.role === "coach"
        ? "Coach Advance+"
        : "Miembro Advance+";
  }

  if (avatar && profile.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.color = "transparent";
    avatar.style.backgroundSize = "cover";
  }
}

/* ==================================================
   3. GAMIFICACIÓN (XP, NIVEL, RACHAS)
================================================== */
function renderGamification(stats) {
  if (!stats) return;

  const xp = stats.xp_total ?? 0;
  const level = stats.level ?? 1;
  const streakCurrent = stats.streak_current ?? 0;
  const streakBest = stats.streak_best ?? 0;

  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;

  const levelEl = qs("#levelLabel");
  const xpTotalEl = qs("#xpTotalLabel");
  const xpNextEl = qs("#xpNextLabel");
  const streakCurrentEl = qs("#streakCurrent");
  const streakBestEl = qs("#streakBest");
  const bar = qs("#xpBarFill");

  if (levelEl) levelEl.textContent = level;
  if (xpTotalEl) xpTotalEl.textContent = `${xp} XP`;
  if (xpNextEl)
    xpNextEl.textContent = `${xpToNext} XP para el siguiente nivel`;
  if (streakCurrentEl) streakCurrentEl.textContent = `${streakCurrent} 🔥`;
  if (streakBestEl) streakBestEl.textContent = `${streakBest} 🏆`;

  if (bar) {
    const pct = Math.min(100, (xpInLevel / 100) * 100);
    setTimeout(() => {
      bar.style.width = `${pct}%`;
    }, 150);
  }
}

/* ==================================================
   4. CURSOS ACTIVOS (RETOS ACTIVOS)
   → join manual, ordenado por started_at
================================================== */
async function loadActiveCourses(userId) {
  const { data: userCourses, error } = await supabase
    .from("user_courses")
    .select("course_id, status, started_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error cargando user_courses:", error);
    return [];
  }

  const activeCourses = [];

  for (const uc of userCourses || []) {
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, title, slug, cover_url, category, level, duration_days, active")
      .eq("id", uc.course_id)
      .single();

    if (!cErr && course && course.active) {
      activeCourses.push(course);
    }
  }

  return activeCourses;
}

function renderActiveCourses(active) {
  const grid = qs("#activeCoursesGrid");
  const msg = qs("#noActiveMessage");
  const count = qs("#activeCount");

  if (!grid || !msg || !count) return;

  grid.innerHTML = "";

  if (!active.length) {
    msg.style.display = "block";
    count.textContent = "";
    return;
  }

  msg.style.display = "none";
  count.textContent = `${active.length} activos`;

  active.forEach((course) => {
    const card = document.createElement("article");
    card.className = "course-card clickable";
    card.dataset.id = course.id;

    const cover =
      course.cover_url ||
      "https://via.placeholder.com/600x300.png?text=Advance%2B";

    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover" />
        <span class="course-badge">${course.category || "Reto"}</span>
      </div>

      <div class="course-body">
        <div class="course-title">${course.title}</div>
        <div class="course-meta">${course.level || "Todos los niveles"}</div>
      </div>
    `;

    // CLICK EN TODA LA TARJETA
active.forEach((course) => {
  const card = document.createElement("article");
  card.className = "course-card clickable";
  card.dataset.id = course.id;

  const cover =
    course.cover_url ||
    "https://via.placeholder.com/600x300.png?text=Advance%2B";

  card.innerHTML = `
    <div class="course-cover-wrapper">
      <img src="${cover}" class="course-cover" />
      <span class="course-badge">${course.category || "Reto"}</span>
    </div>

    <div class="course-body">
      <div class="course-title">${course.title}</div>
      <div class="course-meta">${course.level || "Todos los niveles"}</div>
    </div>
  `;

  // CLICK EN TODA LA TARJETA → auto-day
  card.addEventListener("click", async () => {
    const { data: progressRows, error } = await supabase
      .from("progress")
      .select("day, completed")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .order("day", { ascending: true });

    let nextDay = 1;

    if (!error && progressRows?.length) {
      const completedDays = progressRows.filter((p) => p.completed);
      if (completedDays.length > 0) {
        const lastDone = completedDays[completedDays.length - 1].day;
        nextDay = lastDone + 1;
      }
    }

    if (nextDay > course.duration_days) {
      nextDay = course.duration_days;
    }

    window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
  });

  grid.appendChild(card);


  });
}


/* ==================================================
   5. EXPLORAR RETOS (CURSOS DISPONIBLES)
================================================== */
async function loadAvailableCourses(userId) {
  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  if (cErr) {
    console.error("Error cargando courses:", cErr);
    return [];
  }

  const { data: myCourses, error: ucErr } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  if (ucErr) {
    console.error("Error cargando user_courses:", ucErr);
    return courses || [];
  }

  const ownedIds = new Set((myCourses || []).map((c) => c.course_id));

  return (courses || []).filter((c) => !ownedIds.has(c.id));
}

function renderAvailableCourses(courses) {
  const grid = qs("#availableCoursesGrid");
  const msg = qs("#noAvailableMessage");

  if (!grid || !msg) return;

  grid.innerHTML = "";

  if (!courses.length) {
    msg.style.display = "block";
    return;
  }

  msg.style.display = "none";

  courses.forEach((course) => {
    const card = document.createElement("div");
    card.className = "course-card clickable";
    card.dataset.id = course.id;

    const cover =
      course.cover_url ||
      "https://via.placeholder.com/600x300.png?text=Advance%2B";

    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover" />
        <span class="course-badge">${course.category || "Reto"}</span>
      </div>

      <div class="course-body">
        <div class="course-title">${course.title}</div>
        <div class="course-meta">${course.level || ""}</div>
      </div>
    `;

    // CLICK EN TODA LA TARJETA
    card.addEventListener("click", () => {
      window.location.href = `/curso-info/index.html?c=${course.id}`;
    });

    grid.appendChild(card);
  });
}


/* ==================================================
   6. LOGOUT
================================================== */
function setupLogout() {
  const btn = qs("#btnLogout");
  if (!btn) return;

  btn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

/* ==================================================
   7. INIT
================================================== */
async function initDashboard() {
  setupLogout();

  const data = await loadUserData();
  if (!data) return;

  const { user, profile, stats } = data;

  renderUser(profile);
  renderGamification(stats);

  const active = await loadActiveCourses(user.id);
  renderActiveCourses(active);

  const available = await loadAvailableCourses(user.id);
  renderAvailableCourses(available);
}

initDashboard();

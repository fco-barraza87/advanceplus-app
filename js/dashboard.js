import { supabase } from "/js/supabase.js";

/* Helpers */
const qs = (sel) => document.querySelector(sel);

/* ==================================================
   1. LOAD USER + PROFILE + USER_STATS
================================================== */
async function loadUserData() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Perfil principal
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_url, role, xp_total, streak_current, streak_best"
    )
    .eq("id", user.id)
    .single();

  if (pErr) {
    console.error("Error cargando profile:", pErr);
  }

  // Stats (opcional, se usa como extra)
  const { data: stats, error: sErr } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (sErr) {
    console.warn("user_stats no encontrado (se usará solo profiles):", sErr);
  }

  return { user, profile, stats };
}

/* ==================================================
   2. RENDER USER INFO
================================================== */
function renderUser(profile) {
  if (!profile) return;

  qs("#userName").textContent = profile.full_name || "Usuario";
  qs("#userRole").textContent =
    profile.role === "admin"
      ? "Administrador Advance+"
      : profile.role === "coach"
      ? "Coach Advance+"
      : "Miembro Advance+";

  const avatar = qs("#userAvatar");
  if (avatar && profile.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.color = "transparent";
    avatar.style.backgroundSize = "cover";
  }
}

/* ==================================================
   3. RENDER GAMIFICATION (XP, NIVEL, RACHAS)
   Usa primero user_stats; si falta algo, usa profiles.
================================================== */
function renderGamification(stats, profile) {
  if (!stats && !profile) return;

  const xp =
    stats?.xp_total ??
    profile?.xp_total ??
    0;

  const level = stats?.level ?? 1;

  const streakCurrent =
    stats?.streak_current ??
    profile?.streak_current ??
    0;

  const streakBest = profile?.streak_best ?? 0;

  // XP dentro del nivel
  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;

  qs("#levelLabel").textContent = level;
  qs("#xpTotalLabel").textContent = `${xp} XP`;
  qs("#xpNextLabel").textContent = `${xpToNext} XP para el siguiente nivel`;
  qs("#streakCurrent").textContent = `${streakCurrent} 🔥`;
  qs("#streakBest").textContent = `${streakBest} 🏆`;

  const bar = qs("#xpBarFill");
  if (bar) {
    const pct = Math.min(100, (xpInLevel / 100) * 100);
    setTimeout(() => {
      bar.style.width = `${pct}%`;
    }, 150);
  }
}

/* ==================================================
   4. LOAD ACTIVE COURSES (join manual, sin depender de FK)
================================================== */
async function loadActiveCourses(userId) {
  const { data: userCourses, error } = await supabase
    .from("user_courses")
    .select("course_id, status, start_date")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("start_date", { ascending: false });

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

    if (!cErr && course) {
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
    const card = document.createElement("div");
    card.className = "course-card";

    const cover =
      course.cover_url ||
      "https://via.placeholder.com/600x300.png?text=Advance%2B";

    card.innerHTML = `
      <img src="${cover}" class="course-cover" />
      <div class="course-info">
        <h3>${course.title}</h3>
        <p>${course.category || ""}</p>
      </div>
      <button class="btn-course" data-id="${course.id}">
        Continuar
      </button>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll(".btn-course").forEach((btn) => {
    btn.onclick = () => {
      const course = btn.dataset.id;
      window.location.href = `/curso/index.html?c=${course}&day=1`;
    };
  });
}

/* ==================================================
   5. LOAD AVAILABLE COURSES (EXPLORAR RETOS)
================================================== */
async function loadAvailableCourses(userId) {
  // todos los cursos activos
  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  if (cErr) {
    console.error("Error cargando courses:", cErr);
    return [];
  }

  // cursos del usuario
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
    card.className = "course-card";

    const cover =
      course.cover_url ||
      "https://via.placeholder.com/600x300.png?text=Advance%2B";

    card.innerHTML = `
      <img src="${cover}" class="course-cover" />
      <div class="course-info">
        <h3>${course.title}</h3>
        <p>${course.category || ""}</p>
      </div>
      <button class="btn-course-secondary">
        Ver detalles
      </button>
    `;

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
  renderGamification(stats, profile);

  const active = await loadActiveCourses(user.id);
  renderActiveCourses(active);

  const available = await loadAvailableCourses(user.id);
  renderAvailableCourses(available);
}

initDashboard();

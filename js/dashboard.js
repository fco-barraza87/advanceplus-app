import { supabase } from "/js/supabase.js";

/* Helpers */
const qs = sel => document.querySelector(sel);

/* ==================================================
   1. LOAD USER + PROFILE + USER_STATS
================================================== */
async function loadUserData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1) Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, streak_best, role")
    .eq("id", user.id)
    .single();

  // 2) Stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .single();

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
  if (profile.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.color = "transparent";
    avatar.style.backgroundSize = "cover";
  }
}

/* ==================================================
   3. RENDER GAMIFICATION (XP, NIVEL, RACHAS)
================================================== */
function renderGamification(stats) {
  if (!stats) return;

    const xp = profile.xp_total ?? 0;
    const level = profile.level ?? 1;
    const streakCurrent = profile.streak_current ?? 0;
    const streakBest = profile.streak_best ?? 0;

  // XP dentro del nivel
  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;

  qs("#levelLabel").textContent = level;
  qs("#xpTotalLabel").textContent = `${xp} XP`;
  qs("#xpNextLabel").textContent = `${xpToNext} XP para el siguiente nivel`;
  qs("#streakCurrent").textContent = `${streakCurrent} 🔥`;
  qs("#streakBest").textContent = `${streakBest} 🏆`;

  const bar = qs("#xpBarFill");
  const pct = Math.min(100, (xpInLevel / 100) * 100);
  setTimeout(() => {
    bar.style.width = `${pct}%`;
  }, 150);
}

/* ==================================================
   4. LOAD ACTIVE COURSES
================================================== */
async function loadActiveCourses(userId) {
  const { data } = await supabase
    .from("user_courses")
    .select("course_id, courses(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  return data || [];
}

function renderActiveCourses(active) {
  const grid = qs("#activeCoursesGrid");
  const msg = qs("#noActiveMessage");
  const count = qs("#activeCount");

  grid.innerHTML = "";

  if (!active.length) {
    msg.style.display = "block";
    count.textContent = "";
    return;
  }

  msg.style.display = "none";
  count.textContent = `${active.length} activos`;

  active.forEach(({ courses }) => {
    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <img src="${courses.cover_url}" class="course-cover" />
      <div class="course-info">
        <h3>${courses.title}</h3>
        <p>${courses.category}</p>
      </div>
      <button class="btn-course" data-id="${courses.id}">
        Continuar
      </button>
    `;

    grid.appendChild(card);
  });

  document.querySelectorAll(".btn-course").forEach(btn => {
    btn.onclick = () => {
      const course = btn.dataset.id;
      window.location.href = `/curso/index.html?c=${course}&day=1`;
    };
  });
}

/* ==================================================
   5. LOAD AVAILABLE COURSES
================================================== */
async function loadAvailableCourses(userId) {
  // 1) todos los cursos
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  // 2) cursos del usuario
  const { data: myCourses } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  const ownedIds = new Set(myCourses?.map(c => c.course_id));

  return courses.filter(c => !ownedIds.has(c.id));
}

function renderAvailableCourses(courses) {
  const grid = qs("#availableCoursesGrid");
  const msg = qs("#noAvailableMessage");

  grid.innerHTML = "";

  if (!courses.length) {
    msg.style.display = "block";
    return;
  }

  msg.style.display = "none";

  courses.forEach(course => {
    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <img src="${course.cover_url}" class="course-cover" />
      <div class="course-info">
        <h3>${course.title}</h3>
        <p>${course.category}</p>
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
  qs("#btnLogout").onclick = async () => {
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

  renderUser(data.profile);
  renderGamification(data.stats);

  const active = await loadActiveCourses(data.user.id);
  renderActiveCourses(active);

  const available = await loadAvailableCourses(data.user.id);
  renderAvailableCourses(available);
}

initDashboard();

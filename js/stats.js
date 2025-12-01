import { supabase } from "/js/supabase.js";
const $ = (q) => document.querySelector(q);

/* ============================================================
   1. CARGAR USER + STATS
============================================================ */
async function loadUserData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return { user, stats };
}

/* ============================================================
   2. CARGAR CURSOS
============================================================ */
async function loadUserCourses(userId) {
  const { data } = await supabase
    .from("user_courses")
    .select("course_id, progress_pct, status, xp_gained, courses!inner(id,title,cover_url,category,duration_days)")
    .eq("user_id", userId);

  return data || [];
}

/* ============================================================
   3. PANEL SUPERIOR
============================================================ */
function renderTopStats(stats, courses) {

  /* Nivel + XP */
  $("#statLevel").textContent = stats.level;
  $("#statTotalXP").textContent = stats.xp_total;

  const xpTotal = stats.xp_total;
  const xpNext = stats.xp_next_level || 100;
  $("#statXPText").textContent = `${xpTotal} / ${xpNext} XP`;

  const pctXP = Math.min(100, (xpTotal / xpNext) * 100);
  $("#xpFill").style.width = pctXP + "%";

  /* Racha */
  $("#statStreak").textContent = stats.streak_current;
  $("#statBestStreak").textContent = stats.streak_best;

  const goal = 21; // opcional
  $("#streakFill").style.width = Math.min(100, stats.streak_current / goal * 100) + "%";

  /* Cursos completados */
  const completed = courses.filter(c => c.status === "completed").length;
  $("#statCoursesCompleted").textContent = completed;
}

/* ============================================================
   4. TIMELINE
============================================================ */
function renderTimeline(stats, courses) {
  const cont = $("#timelineContainer");
  cont.innerHTML = "";

  const events = [];

  events.push({ t: "Nivel alcanzado", sub: `Nivel ${stats.level}` });
  events.push({ t: "Mejor racha", sub: `${stats.streak_best} días` });

  courses.forEach(c => {
    if (c.status === "completed") {
      events.push({
        t: "Curso completado",
        sub: c.courses.title
      });
    }
  });

  events.forEach(ev => {
    const div = document.createElement("div");
    div.className = "timeline-item";

    div.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-title">${ev.t}</div>
      <div class="timeline-sub">${ev.sub}</div>
    `;

    cont.appendChild(div);
  });
}

/* ============================================================
   5. XP ÚLTIMAS 4 SEMANAS
============================================================ */
async function loadWeeklyXP(userId) {
  const { data } = await supabase.rpc("xp_last_4_weeks", { p_user_id: userId }) || [];
  return data || [];
}

function renderWeeklyXP(weeks) {
  const cont = $("#weekXPBars");
  cont.innerHTML = "";

  weeks.forEach((w, i) => {
    const div = document.createElement("div");
    div.className = "week-bar";
    div.innerHTML = `
      <div class="week-label">Semana ${i+1}: ${w} XP</div>
      <div class="week-bar-fill" style="width:${Math.min(100, w)}%"></div>
    `;
    cont.appendChild(div);
  });
}

/* ============================================================
   6. ACTIVIDAD ÚLTIMOS 30 DÍAS
============================================================ */
async function loadActivity(userId) {
  const { data } = await supabase.rpc("activity_last_30_days", { p_user_id: userId }) || [];
  return data || [];
}

function renderActivity(days) {
  const cont = $("#activityDots");
  cont.innerHTML = "";

  days.forEach(d => {
    const dot = document.createElement("div");
    dot.className = "act-dot" + (d.active ? " active" : "");
    cont.appendChild(dot);
  });
}

/* ============================================================
   7. PROGRESO POR CURSO
============================================================ */
function renderCourseProgress(courses) {
  const grid = $("#coursesStatsGrid");
  const empty = $("#statsNoCourses");

  if (!courses.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  grid.innerHTML = "";

  courses.forEach(c => {
    const pct = c.progress_pct || 0;
    const cover = c.courses.cover_url || "https://via.placeholder.com/600x300?text=A+";

    const div = document.createElement("div");
    div.className = "course-card";
    div.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${cover}" class="course-cover"/>
      </div>
      <div class="course-body">
        <div class="course-title">${c.courses.title}</div>
        <div class="course-meta">${c.courses.category}</div>

        <div class="progress-bar" style="margin-top:10px;">
          <div class="progress-fill" style="width:${pct}%;"></div>
        </div>

        <div class="course-meta" style="margin-top:6px;">
          ${Math.round(pct)}% — XP: ${c.xp_gained ?? 0}
        </div>
      </div>
    `;

    grid.appendChild(div);
  });
}

/* ============================================================
   8. INIT
============================================================ */
async function init() {

  const data = await loadUserData();
  if (!data) return;

  const { user, stats } = data;

  const courses = await loadUserCourses(user.id);

  // panel superior
  renderTopStats(stats, courses);

  // timeline
  renderTimeline(stats, courses);

  // XP semanal
  const weekXP = await loadWeeklyXP(user.id);
  renderWeeklyXP(weekXP);

  // actividad 30 días
  const activity = await loadActivity(user.id);
  renderActivity(activity);

  // progreso por curso
  renderCourseProgress(courses);
}

init();

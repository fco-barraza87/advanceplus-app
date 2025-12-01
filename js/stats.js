// /js/stats.js
import { supabase } from "/js/supabase.js";

const qs = (sel) => document.querySelector(sel);

/* ============================================
   1. AUTH + CARGA PRINCIPAL
============================================ */

async function initStatsPage() {
  // 1) Usuario actual
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    window.location.href = "/index.html";
    return;
  }

  // 2) Carga paralela: stats, progreso 30 días, cursos
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [{ data: stats }, { data: progressRows }, { data: userCourses }] =
    await Promise.all([
      supabase
        .from("user_stats")
        .select("xp_total, streak_current, streak_best, level")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("progress")
        .select("day, completed, xp, updated_at")
        .eq("user_id", user.id)
        .gte("updated_at", sinceIso),
      supabase
        .from("user_courses")
        .select("status, progress_pct"),
    ]);

  // Normalizar arrays
  const progress = progressRows || [];
  const courses = userCourses || [];

  // 3) Render de cada bloque
  renderSummary(stats, progress, courses);
  renderWeeklyXP(progress);
  renderHeatmap(progress);
  renderAchievements(stats, progress, courses);

  // 4) Logout (igual que dashboard)
  setupLogout();
}

/* ============================================
   2. LOGOUT
============================================ */

function setupLogout() {
  const btn = qs("#btnLogout");
  if (!btn) return;

  btn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  };
}

/* ============================================
   3. RESUMEN GENERAL
============================================ */

function renderSummary(stats, progress, courses) {
  if (!stats) return;

  const xpTotal = stats.xp_total ?? 0;
  const level = stats.level ?? 1;
  const streak = stats.streak_current ?? 0;
  const bestStreak = stats.streak_best ?? 0;

  // Días activos en los últimos 30 días
  const daysSet = new Set();
  (progress || []).forEach((row) => {
    const dateStr = toDateKey(row.updated_at);
    daysSet.add(dateStr);
  });
  const activeDays = daysSet.size;

  // Cursos completados (status o progreso_pct >= 95)
  const doneCourses = (courses || []).filter(
    (c) =>
      c.status === "completed" ||
      (typeof c.progress_pct === "number" && c.progress_pct >= 95)
  ).length;

  qs("#summaryLevel").textContent = `Nivel ${level}`;
  qs("#summaryXP").textContent = `${xpTotal} XP`;
  qs("#summaryStreak").textContent = `${streak} días`;
  qs("#summaryBestStreak").textContent = `${bestStreak} días`;
  qs("#summaryActiveDays").textContent = `${activeDays} / 30`;
  qs("#summaryCoursesDone").textContent = doneCourses.toString();
}

/* ============================================
   4. XP SEMANAL (4 SEMANAS)
============================================ */

function renderWeeklyXP(progress) {
  const now = new Date();
  const weeks = [0, 0, 0, 0]; // 0=Hace 4 sem, 3=Esta semana

  (progress || []).forEach((row) => {
    const xp = row.xp || 0;
    if (xp <= 0) return;

    const updated = row.updated_at ? new Date(row.updated_at) : null;
    if (!updated) return;

    const diffMs = now - updated;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 27) return;

    const weekFromNow = Math.floor(diffDays / 7); // 0..3 (0 = esta semana)
    const index = 3 - weekFromNow; // 3 actual, 0 hace 4 semanas
    if (index < 0 || index > 3) return;

    weeks[index] += xp;
  });

  const maxXP = Math.max(...weeks, 1);

  const chart = qs("#weeklyChart");
  if (!chart) return;

  const cols = chart.querySelectorAll(".week-col");
  cols.forEach((col, i) => {
    const bar = col.querySelector(".week-bar");
    const xpLabel = col.querySelector("[data-week-xp]");
    const xpVal = weeks[i];

    const heightPct = (xpVal / maxXP) * 100;
    bar.style.height = `${Math.max(10, heightPct)}%`;
    bar.style.opacity = xpVal > 0 ? 1 : 0.25;

    if (xpLabel) xpLabel.textContent = `${xpVal} XP`;
  });

  // Resumen de esta semana vs anterior
  const xpThisWeek = weeks[3];
  const xpPrevWeek = weeks[2];

  let summary = `Esta semana llevas ${xpThisWeek} XP.`;
  if (xpPrevWeek > 0) {
    const diff = xpThisWeek - xpPrevWeek;
    const pct = Math.round((diff / xpPrevWeek) * 100);
    if (pct > 0) summary += ` (+${pct}% vs semana anterior)`;
    else if (pct < 0) summary += ` (${pct}% vs semana anterior)`;
    else summary += ` (igual que la semana anterior)`;
  }

  const weeklySummary = qs("#weeklySummary");
  if (weeklySummary) weeklySummary.textContent = summary;
}

/* ============================================
   5. HEATMAP 30 DÍAS
============================================ */

function renderHeatmap(progress) {
  const container = qs("#activityHeatmap");
  if (!container) return;

  container.innerHTML = "";

  // Sum XP por día
  const xpByDay = {};
  (progress || []).forEach((row) => {
    const key = toDateKey(row.updated_at);
    if (!key) return;
    xpByDay[key] = (xpByDay[key] || 0) + (row.xp || 0);
  });

  const now = new Date();
  let activeDays = 0;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const xp = xpByDay[key] || 0;

    if (xp > 0) activeDays++;

    const cell = document.createElement("div");
    cell.className = "day-cell";

    const inner = document.createElement("div");
    inner.classList.add("day-cell-inner");

    const cls =
      xp === 0
        ? "heat-none"
        : xp <= 10
        ? "heat-low"
        : xp <= 30
        ? "heat-med"
        : "heat-high";

    inner.classList.add(cls);
    inner.title = `${key}: ${xp} XP`;

    cell.appendChild(inner);
    container.appendChild(cell);
  }

  const summary = qs("#heatmapSummary");
  if (summary) {
    summary.textContent = `${activeDays} días con actividad en los últimos 30.`;
  }
}

/* ============================================
   6. LOGROS A+
============================================ */

function renderAchievements(stats, progress, courses) {
  const list = qs("#achievementsList");
  if (!list || !stats) return;

  list.innerHTML = "";

  const xpTotal = stats.xp_total ?? 0;
  const streak = stats.streak_current ?? 0;
  const bestStreak = stats.streak_best ?? 0;

  // Días activos
  const daysSet = new Set();
  (progress || []).forEach((row) => {
    daysSet.add(toDateKey(row.updated_at));
  });
  const activeDays = daysSet.size;

  // Cursos completados
  const doneCourses = (courses || []).filter(
    (c) =>
      c.status === "completed" ||
      (typeof c.progress_pct === "number" && c.progress_pct >= 95)
  ).length;

  // Reglas de logros simples
  const achievements = [
    {
      key: "first_day",
      title: "Despegue A+",
      desc: "Completaste tu primer día activo dentro de Advance+.",
      achieved: activeDays >= 1,
      progressText: activeDays >= 1 ? "1 / 1 día" : `${activeDays} / 1 día`,
      badge: "🏁 Básico",
    },
    {
      key: "mini_streak",
      title: "Mini racha",
      desc: "Mantén una racha de 3 días seguidos entrenando.",
      achieved: bestStreak >= 3,
      progressText:
        bestStreak >= 3 ? `${bestStreak} / 3 días` : `${bestStreak} / 3 días`,
      badge: "🔥 Constancia",
    },
    {
      key: "streak_7",
      title: "Semana de enfoque",
      desc: "Consigue una racha de 7 días seguidos.",
      achieved: bestStreak >= 7,
      progressText:
        bestStreak >= 7 ? `${bestStreak} / 7 días` : `${bestStreak} / 7 días`,
      badge: "🔥🔥 Disciplina",
    },
    {
      key: "xp_200",
      title: "XP 200+",
      desc: "Acumula al menos 200 XP en tus retos.",
      achieved: xpTotal >= 200,
      progressText:
        xpTotal >= 200 ? `${xpTotal} / 200 XP` : `${xpTotal} / 200 XP`,
      badge: "⭐ Progreso",
    },
    {
      key: "xp_500",
      title: "XP 500+",
      desc: "Acumula 500 XP o más. Estás construyendo una nueva identidad.",
      achieved: xpTotal >= 500,
      progressText:
        xpTotal >= 500 ? `${xpTotal} / 500 XP` : `${xpTotal} / 500 XP`,
      badge: "🌟 Avanzado",
    },
    {
      key: "first_course",
      title: "Primer reto completado",
      desc: "Termina un curso completo dentro de Advance+.",
      achieved: doneCourses >= 1,
      progressText:
        doneCourses >= 1
          ? `${doneCourses} / 1 curso`
          : `${doneCourses} / 1 curso`,
      badge: "📘 Reto",
    },
  ];

  achievements.forEach((ach) => {
    const card = document.createElement("article");
    card.className = "achievement-card";
    card.classList.add(ach.achieved ? "achieved" : "pending");

    card.innerHTML = `
      <div class="achievement-header">
        <div class="achievement-title">
          ${ach.badge} ${ach.title}
        </div>
        <span class="achievement-badge">
          ${ach.achieved ? "Completado" : "En progreso"}
        </span>
      </div>
      <p class="achievement-desc">${ach.desc}</p>
      <p class="achievement-progress">${ach.progressText}</p>
    `;

    list.appendChild(card);
  });
}

/* ============================================
   UTILIDAD: Normalizar fecha a YYYY-MM-DD
============================================ */

function toDateKey(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/* ============================================
   INIT
============================================ */

initStatsPage();

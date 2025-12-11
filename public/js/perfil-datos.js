// /js/perfil-datos.js
import { supabase } from "/js/supabase.js";
import { getCurrentUserWithProfile } from "/js/auth.js";

const qs = (s) => document.querySelector(s);

let mindsetRawData = [];
let mindsetChart = null;

/* ============================================
   UTILIDADES
============================================ */
function formatDateShort(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

/* ============================================
   1. STATS GENERALES
============================================ */
async function loadStats(userId) {
  // Intentar leer user_stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best")
    .eq("user_id", userId)
    .maybeSingle();

  let streakCurrent = stats?.streak_current ?? 0;
  let streakBest = stats?.streak_best ?? 0;

  // Si no existe user_stats, usar profiles
  if (!stats) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp_total, streak_current, streak_best")
      .eq("id", userId)
      .maybeSingle();

    streakCurrent = profile?.streak_current ?? 0;
    streakBest = profile?.streak_best ?? 0;
  }

  // Disciplina
  const { data: progress } = await supabase
    .from("progress")
    .select("completed")
    .eq("user_id", userId);

  const total = progress?.length ?? 0;
  const done = (progress || []).filter((p) => p.completed).length;
  const disciplinePct = total > 0 ? Math.round((done / total) * 100) : 0;

  // FocusTime estimado
  const focusMinutes = done * 10;
  const hours = Math.floor(focusMinutes / 60);
  const minutes = focusMinutes % 60;

  const focusLabel =
    focusMinutes === 0
      ? "0 min"
      : hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes} min`;

  // Pintar
  qs("#statStreakCurrent").textContent = streakCurrent;
  qs("#statStreakBest").textContent = streakBest;
  qs("#statDiscipline").textContent = `${disciplinePct}%`;
  qs("#statFocusTime").textContent = focusLabel;
}

/* ============================================
   2. MINDSET & ENERGÍA
============================================ */

/* ---- Obtener datos crudos ---- */
async function fetchMindsetLogs(userId) {
  const { data, error } = await supabase
    .from("mindset_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[perfil/datos] Error cargando mindset_logs:", error);
    return [];
  }

  return data || [];
}

/* ---- Lógica de filtrado ---- */
function filterMindsetData(range) {
  if (range === "all") return mindsetRawData;

  const days = Number(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return mindsetRawData.filter(
    (row) => new Date(row.created_at) >= cutoff
  );
}

/* ---- Render del gráfico ---- */
function renderMindsetChart(rows) {
  const canvas = qs("#mindsetChart");
  const emptyMsg = qs("#mindsetEmptyMessage");

  if (!rows.length) {
    canvas.style.display = "none";
    emptyMsg.style.display = "block";
    return;
  }

  canvas.style.display = "block";
  emptyMsg.style.display = "none";

  const labels = rows.map((r) => formatDateShort(r.created_at));

  const enfoque = rows.map((r) => r.enfoque);
  const energia = rows.map((r) => r.energia);
  const motivacion = rows.map((r) => r.motivacion);
  const claridad = rows.map((r) => r.claridad);
  const confianza = rows.map((r) => r.confianza);

  if (mindsetChart) mindsetChart.destroy();

  const ctx = canvas.getContext("2d");

  mindsetChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Enfoque", data: enfoque, borderWidth: 2, tension: 0.3 },
        { label: "Energía", data: energia, borderWidth: 2, tension: 0.3 },
        { label: "Motivación", data: motivacion, borderWidth: 2, tension: 0.3 },
        { label: "Claridad", data: claridad, borderWidth: 2, tension: 0.3 },
        { label: "Confianza", data: confianza, borderWidth: 2, tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650 },
      scales: {
        y: {
          min: 1,
          max: 5,
          ticks: { stepSize: 1, color: "rgba(255,255,255,0.75)" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        x: {
          ticks: { color: "rgba(255,255,255,0.75)" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "white", usePointStyle: true },
        },
      },
    },
  });
}

/* ---- Inicializar botones de filtro ---- */
function initMindsetFilters() {
  const buttons = document.querySelectorAll(".mindset-filter-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const range = btn.dataset.range;
      const filtered = filterMindsetData(range);
      renderMindsetChart(filtered);
    });
  });
}

/* ---- Cargar gráfico completo ---- */
async function loadMindsetChart(userId) {
  mindsetRawData = await fetchMindsetLogs(userId);

  initMindsetFilters();

  // Filtro por defecto → últimos 30 días
  const defaultRows = filterMindsetData("30");
  renderMindsetChart(defaultRows);
}

/* ============================================
   3. PROGRESO DE RETOS
============================================ */
async function loadCoursesProgress(userId) {
  const listEl = qs("#coursesProgressList");
  const emptyEl = qs("#coursesProgressEmpty");

  const { data: userCourses } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  if (!userCourses?.length) {
    emptyEl.style.display = "block";
    return;
  }

  const courseIds = userCourses.map((c) => c.course_id);

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, duration_days")
    .in("id", courseIds);

  const courseMap = new Map();
  courses.forEach((c) => courseMap.set(c.id, c));

  const { data: progress } = await supabase
    .from("progress")
    .select("course_id, completed")
    .eq("user_id", userId)
    .in("course_id", courseIds);

  const agg = new Map();
  progress.forEach((row) => {
    const entry = agg.get(row.course_id) || { total: 0, done: 0 };
    entry.total++;
    if (row.completed) entry.done++;
    agg.set(row.course_id, entry);
  });

  listEl.innerHTML = "";
  emptyEl.style.display = "none";

  agg.forEach((value, courseId) => {
    const course = courseMap.get(courseId);
    if (!course) return;

    const totalDays = course.duration_days || value.total;
    const pct = Math.round((value.done / totalDays) * 100);

    const item = document.createElement("article");
    item.className = "course-progress-item";

    item.innerHTML = `
      <div class="course-progress-header">
        <div class="course-progress-title">${course.title}</div>
        <div class="course-progress-meta">${pct}%</div>
      </div>

      <div class="course-progress-bar">
        <div class="course-progress-fill" style="width:${pct}%;"></div>
      </div>

      <div class="course-progress-footer">
        <span>${value.done} / ${totalDays} días completados</span>
        <span>${pct >= 100 ? "Completado 🎯" : "En progreso"}</span>
      </div>
    `;

    listEl.appendChild(item);
  });
}

/* ============================================
   INIT
============================================ */
async function initPerfilDatos() {
  const data = await getCurrentUserWithProfile();
  if (!data?.user) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { user } = data;

  await loadStats(user.id);
  await loadMindsetChart(user.id);
  await loadCoursesProgress(user.id);
}

initPerfilDatos();

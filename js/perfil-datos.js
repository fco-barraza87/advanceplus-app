// /js/perfil-datos.js
import { supabase } from "/js/supabase.js";
import { getCurrentUserWithProfile } from "/js/auth.js";

const qs = (s) => document.querySelector(s);

let mindsetChart = null;

/* ================ UTIL ================= */
function formatDateShort(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

/* ================ 1. STATS GENERALES ================= */
async function loadStats(userId) {
  // 1) Intentar desde user_stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best")
    .eq("user_id", userId)
    .maybeSingle();

  let streakCurrent = stats?.streak_current ?? 0;
  let streakBest = stats?.streak_best ?? 0;

  // Si no hay user_stats, intentar desde profiles
  if (!stats) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp_total, streak_current, streak_best")
      .eq("id", userId)
      .maybeSingle();

    streakCurrent = profile?.streak_current ?? 0;
    streakBest = profile?.streak_best ?? 0;
  }

  // 2) Disciplina y FocusTime desde progress
  const { data: progress } = await supabase
    .from("progress")
    .select("completed")
    .eq("user_id", userId);

  const totalEntries = progress?.length ?? 0;
  const completedEntries = (progress || []).filter((p) => p.completed).length;
  const disciplinePct =
    totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;

  // FocusTime estimado: cada lección completada ~10 min
  const focusMinutes = completedEntries * 10;
  const hours = Math.floor(focusMinutes / 60);
  const minutes = focusMinutes % 60;
  const focusLabel =
    focusMinutes === 0
      ? "0 min"
      : hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes} min`;

  // Pintar en DOM
  const streakCurrentEl = qs("#statStreakCurrent");
  const streakBestEl = qs("#statStreakBest");
  const disciplineEl = qs("#statDiscipline");
  const focusEl = qs("#statFocusTime");

  if (streakCurrentEl) streakCurrentEl.textContent = streakCurrent;
  if (streakBestEl) streakBestEl.textContent = streakBest;
  if (disciplineEl) disciplineEl.textContent = `${disciplinePct}%`;
  if (focusEl) focusEl.textContent = focusLabel;
}

/* ================ 2. GRÁFICO MINDSET ================= */
async function loadMindsetChart(userId) {
  const canvas = qs("#mindsetChart");
  const emptyMsg = qs("#mindsetEmptyMessage");
  if (!canvas) return;

  const { data, error } = await supabase
    .from("mindset_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[perfil/datos] Error cargando mindset_logs:", error);
  }

  if (!data || !data.length) {
    if (emptyMsg) emptyMsg.style.display = "block";
    if (canvas) canvas.style.display = "none";
    if (mindsetChart) {
      mindsetChart.destroy();
      mindsetChart = null;
    }
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";
  canvas.style.display = "block";

  const labels = data.map((row) => formatDateShort(row.created_at));

  const enfoque = data.map((row) => row.enfoque ?? null);
  const energia = data.map((row) => row.energia ?? null);
  const motivacion = data.map((row) => row.motivacion ?? null);
  const claridad = data.map((row) => row.claridad ?? null);
  const confianza = data.map((row) => row.confianza ?? null);

  const ctx = canvas.getContext("2d");

  if (mindsetChart) {
    mindsetChart.destroy();
  }

  mindsetChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Enfoque",
          data: enfoque,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Energía",
          data: energia,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Motivación",
          data: motivacion,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Claridad",
          data: claridad,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Confianza",
          data: confianza,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#ffffff",
            usePointStyle: true,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "rgba(255,255,255,0.75)" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { color: "rgba(255,255,255,0.75)", stepSize: 2 },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
}

/* ================ 3. FORM · REGISTRO DIARIO ================= */
async function loadTodayMindset(userId) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );

  const { data, error } = await supabase
    .from("mindset_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows
    console.warn("[perfil/datos] Error cargando registro de hoy:", error);
  }

  return data || null;
}

function setupSlider(idSlider, idValue) {
  const slider = qs(idSlider);
  const value = qs(idValue);

  if (!slider || !value) return;

  value.textContent = slider.value;

  slider.addEventListener("input", () => {
    value.textContent = slider.value;
  });
}

async function setupMindsetForm(userId) {
  setupSlider("#sliderEnfoque", "#valEnfoque");
  setupSlider("#sliderEnergia", "#valEnergia");
  setupSlider("#sliderMotivacion", "#valMotivacion");
  setupSlider("#sliderClaridad", "#valClaridad");
  setupSlider("#sliderConfianza", "#valConfianza");

  const saveBtn = qs("#mindsetSaveBtn");
  const msgEl = qs("#mindsetSaveMessage");

  let existingId = null;

  // Prefill si ya hay registro hoy
  const todayLog = await loadTodayMindset(userId);
  if (todayLog) {
    existingId = todayLog.id;

    const sEnfoque = qs("#sliderEnfoque");
    const sEnergia = qs("#sliderEnergia");
    const sMotivacion = qs("#sliderMotivacion");
    const sClaridad = qs("#sliderClaridad");
    const sConfianza = qs("#sliderConfianza");

    if (sEnfoque && todayLog.enfoque != null) sEnfoque.value = todayLog.enfoque;
    if (sEnergia && todayLog.energia != null) sEnergia.value = todayLog.energia;
    if (sMotivacion && todayLog.motivacion != null)
      sMotivacion.value = todayLog.motivacion;
    if (sClaridad && todayLog.claridad != null)
      sClaridad.value = todayLog.claridad;
    if (sConfianza && todayLog.confianza != null)
      sConfianza.value = todayLog.confianza;

    // Forzar actualizar labels
    setupSlider("#sliderEnfoque", "#valEnfoque");
    setupSlider("#sliderEnergia", "#valEnergia");
    setupSlider("#sliderMotivacion", "#valMotivacion");
    setupSlider("#sliderClaridad", "#valClaridad");
    setupSlider("#sliderConfianza", "#valConfianza");

    if (saveBtn) saveBtn.textContent = "Actualizar registro de hoy";
  }

  if (!saveBtn) return;

  saveBtn.onclick = async () => {
    const enfoque = Number(qs("#sliderEnfoque")?.value ?? 5);
    const energia = Number(qs("#sliderEnergia")?.value ?? 5);
    const motivacion = Number(qs("#sliderMotivacion")?.value ?? 5);
    const claridad = Number(qs("#sliderClaridad")?.value ?? 5);
    const confianza = Number(qs("#sliderConfianza")?.value ?? 5);

    const payload = {
      user_id: userId,
      enfoque,
      energia,
      motivacion,
      claridad,
      confianza,
    };

    let error = null;

    if (existingId) {
      const { error: updErr } = await supabase
        .from("mindset_logs")
        .update(payload)
        .eq("id", existingId);
      error = updErr;
    } else {
      const { data, error: insErr } = await supabase
        .from("mindset_logs")
        .insert(payload)
        .select()
        .maybeSingle();
      error = insErr;
      if (!insErr && data?.id) {
        existingId = data.id;
      }
    }

    if (error) {
      console.error("[perfil/datos] Error guardando mindset:", error);
      if (msgEl) {
        msgEl.textContent = "❌ Error al guardar tu registro.";
        msgEl.style.color = "#ff6b6b";
      }
      return;
    }

    if (msgEl) {
      msgEl.textContent = "✔ Registro guardado correctamente.";
      msgEl.style.color = "#3ee98a";
    }

    if (saveBtn) {
      saveBtn.textContent = "Actualizar registro de hoy";
    }

    await loadMindsetChart(userId);
  };
}

/* ================ 4. PROGRESO EN RETOS ================= */
async function loadCoursesProgress(userId) {
  const listEl = qs("#coursesProgressList");
  const emptyEl = qs("#coursesProgressEmpty");
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = "";

  // 1) Cursos del usuario (activos o en cualquier estado)
  const { data: userCourses } = await supabase
    .from("user_courses")
    .select("course_id, status")
    .eq("user_id", userId);

  if (!userCourses || !userCourses.length) {
    emptyEl.style.display = "block";
    return;
  }

  const courseIds = [...new Set(userCourses.map((c) => c.course_id))];

  // 2) Info de cursos
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, duration_days")
    .in("id", courseIds);

  const courseMap = new Map();
  (courses || []).forEach((c) => courseMap.set(c.id, c));

  // 3) Progreso
  const { data: progress } = await supabase
    .from("progress")
    .select("course_id, completed")
    .eq("user_id", userId)
    .in("course_id", courseIds);

  const agg = new Map();
  (progress || []).forEach((row) => {
    const entry = agg.get(row.course_id) || { total: 0, done: 0 };
    entry.total += 1;
    if (row.completed) entry.done += 1;
    agg.set(row.course_id, entry);
  });

  if (!agg.size) {
    emptyEl.style.display = "block";
    return;
  }

  emptyEl.style.display = "none";

  // 4) Render tarjetas
  agg.forEach((value, courseId) => {
    const course = courseMap.get(courseId);
    if (!course) return;

    const totalDays =
      course.duration_days && course.duration_days > 0
        ? course.duration_days
        : value.total || 1;

    const done = value.done;
    const pct =
      totalDays > 0 ? Math.round((done / totalDays) * 100) : 0;

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
        <span>${done} / ${totalDays} días completados</span>
        <span>${pct >= 100 ? "Completado 🎯" : "En progreso"}</span>
      </div>
    `;

    listEl.appendChild(item);
  });
}

/* ================ 5. INIT ================= */
async function initPerfilDatos() {
  const data = await getCurrentUserWithProfile();
  if (!data || !data.user) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { user } = data;

  await loadStats(user.id);
  await loadMindsetChart(user.id);
  await setupMindsetForm(user.id);
  await loadCoursesProgress(user.id);
}

initPerfilDatos();

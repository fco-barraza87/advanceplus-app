/* ========================================================
   DASHBOARD ADVANCE+  —  Lectura real de Supabase
   Compatible con tablas: users, progress, courses, user_courses
   v1.2 – Actualizado con fallback automático
======================================================== */

const SUPABASE_URL = "https://gwemdxauzhfwwktqbxcm.supabase.co"; // ⚠️ Reemplaza
const SUPABASE_KEY = "sb_publishable_1quYmvn_zmzxGGaIfBSttA_MYs8QFQ1"; // ⚠️ Reemplaza
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ===========================
   🧠 Funciones auxiliares
=========================== */
function calcLevel(totalXp) {
  const level = Math.floor(totalXp / 100) + 1;
  const xpInLevel = totalXp % 100;
  const xpToNext = 100 - xpInLevel;
  const pct = Math.min(100, (xpInLevel / 100) * 100);
  return { level, xpInLevel, xpToNext, pct };
}

function formatInitials(name, email) {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return (email?.[0] || "A").toUpperCase() + "+";
}

/* ===========================
   🚀 Carga principal del dashboard
=========================== */
async function loadDashboard() {
  // 1️⃣ Obtener sesión actual
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) {
    alert("⚠️ No hay sesión activa. Inicia sesión nuevamente.");
    window.location.href = "/";
    return;
  }
  const user = userResp.user;

  // 2️⃣ Mostrar datos básicos
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email.split("@")[0];
  document.getElementById("user-name").textContent = `Hola, ${name}`;
  document.getElementById("user-email").textContent = user.email;
  document.getElementById("avatar-initials").textContent = formatInitials(
    user.user_metadata?.full_name,
    user.email
  );

  /* =====================================================
     🔹 BLOQUE 3 – PROGRESO Y CURSOS ACTIVOS
  ===================================================== */
  const { data: rows, error: pgErr } = await supabase
    .from("progress")
    .select("course_id, completed, xp, day, updated_at, streak")
    .eq("user_id", user.id);

  const progressRows = rows || [];

  // Calcular totales
  const totalXp = progressRows.reduce((s, r) => s + (r.xp || 0), 0);
  const daysActive = new Set(progressRows.map((r) => r.day)).size;
  const streakStored = Math.max(...progressRows.map((r) => r.streak || 0), 0);

  // Nivel y barra XP
  const { level, xpInLevel, xpToNext, pct } = calcLevel(totalXp);
  document.getElementById("level").textContent = level;
  document.getElementById("xp-text").textContent = `${xpInLevel} / 100`;
  document.getElementById("xp-to-next").textContent = xpToNext;
  document.getElementById("xp-total").textContent = totalXp;
  document.getElementById("days-active").textContent = daysActive;
  document.getElementById("streak").textContent = streakStored;
  requestAnimationFrame(() => {
    document.getElementById("xp-fill").style.width = pct + "%";
  });

  /* =====================================================
     🔹 BLOQUE 4 – Lectura combinada: progress + user_courses
  ===================================================== */
  let byCourse = new Map();

  // Si hay progreso, agrupar por curso
  if (progressRows.length > 0) {
    for (const r of progressRows) {
      if (!r.course_id) continue;
      if (!byCourse.has(r.course_id))
        byCourse.set(r.course_id, { total: 0, done: 0 });
      const c = byCourse.get(r.course_id);
      c.total += 1;
      if (r.completed) c.done += 1;
    }
  } else {
    // Fallback: leer desde user_courses
    const { data: ucRows, error: ucErr } = await supabase
      .from("user_courses")
      .select("course_id, status")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (ucRows && ucRows.length > 0) {
      for (const r of ucRows) {
        byCourse.set(r.course_id, { total: 1, done: 0 });
      }
    }
  }

  document.getElementById("courses-count").textContent = byCourse.size;

  // Obtener metadatos del curso
  let coursesMeta = {};
  if (byCourse.size > 0) {
    const ids = Array.from(byCourse.keys());
    const { data: courseRows } = await supabase
      .from("courses")
      .select("id, title, cover_url")
      .in("id", ids);

    if (Array.isArray(courseRows)) {
      for (const c of courseRows) {
        coursesMeta[c.id] = { title: c.title, cover: c.cover_url };
      }
    }
  }

  renderCourses(byCourse, coursesMeta);
  renderBadges(totalXp, streakStored, daysActive);
}

/* ===========================
   🎯 Render: cursos tipo Netflix
=========================== */
function renderCourses(byCourseMap, meta) {
  const grid = document.getElementById("courses-grid");
  grid.innerHTML = "";

  if (!byCourseMap || byCourseMap.size === 0) {
    grid.innerHTML =
      '<p class="text-muted">No tienes retos activos aún. Comienza uno para verlo aquí.</p>';
    return;
  }

  for (const [courseId, info] of byCourseMap.entries()) {
    const pct = info.total ? Math.round((info.done / info.total) * 100) : 0;
    const title = meta[courseId]?.title || `Reto #${courseId}`;
    const cover = meta[courseId]?.cover || "/assets/placeholder.png";

    const card = document.createElement("article");
    card.className = "course";
    card.innerHTML = `
      <div class="cover" style="background-image:url('${cover}')"></div>
      <div class="course-body">
        <div class="course-title">${title}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:0%"></div>
        </div>
        <div class="progress-label text-muted">${pct}% completado</div>
      </div>
    `;
    grid.appendChild(card);
    requestAnimationFrame(() => {
      card.querySelector(".progress-fill").style.width = pct + "%";
    });
  }
}

/* ===========================
   🏅 Render: medallas
=========================== */
function renderBadges(totalXp, streak, daysActive) {
  const cont = document.getElementById("badges");
  const empty = document.getElementById("badges-empty");
  cont.innerHTML = "";

  const earned = [];
  if (totalXp >= 50) earned.push({ icon: "🏁", name: "Primeros 50 XP" });
  if (totalXp >= 100) earned.push({ icon: "💥", name: "Nivel 2" });
  if (streak >= 3) earned.push({ icon: "🔥", name: "Racha x3" });
  if (streak >= 7) earned.push({ icon: "⚡", name: "Racha x7" });
  if (daysActive >= 5) earned.push({ icon: "📅", name: "5 días activo" });

  if (earned.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const b of earned) {
    const el = document.createElement("div");
    el.className = "badge";
    el.innerHTML = `
      <div class="icon">${b.icon}</div>
      <div class="name">${b.name}</div>
    `;
    cont.appendChild(el);
  }
}

/* ===========================
   🚪 Logout
=========================== */
document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  alert("👋 Sesión cerrada correctamente.");
  window.location.href = "/";
});

/* 🟢 Ejecutar */
loadDashboard();

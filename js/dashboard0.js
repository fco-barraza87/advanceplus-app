// /js/dashboard.js
import { supabase } from "/js/supabase.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderAvatar(profile) {
  const avatarContainer = document.getElementById("userAvatar");
  if (!avatarContainer) return;

  if (profile?.avatar_url) {
    avatarContainer.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" />`;
    return;
  }

  const name = profile?.display_name || profile?.full_name || profile?.email || "A+";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  avatarContainer.textContent = initials;
}

function renderGamification(g) {
  const xp = g.xp_total ?? 0;
  const level = g.level ?? 1;
  const streakCurrent = g.streak_current ?? 0;
  const streakBest = g.streak_best ?? 0;

  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;

  setText("levelLabel", level);
  setText("xpTotalLabel", `${xp} XP`);
  setText("xpNextLabel", `${xpToNext} XP para el siguiente nivel`);
  setText("streakCurrent", `${streakCurrent} 🔥`);
  setText("streakBest", `${streakBest} 🏆`);

  const xpBarFill = document.getElementById("xpBarFill");
  if (xpBarFill) {
    const percent = Math.min(100, (xpInLevel / 100) * 100);
    setTimeout(() => {
      xpBarFill.style.width = `${percent}%`;
    }, 150);
  }
}

/**
 * Intenta cargar gamificación desde user_stats.
 * Si no hay fila, usa los campos de profiles.
 */
async function fetchGamification(userId, profile) {
  // 1) Intentar user_stats (si lo estás usando en tu BD)
  const { data: stats, error } = await supabase
    .from("user_stats")
    .select("xp_total, level, streak_current")
    .eq("user_id", userId)
    .maybeSingle(); // no explota si no existe

  if (!error && stats) {
    return {
      xp_total: stats.xp_total ?? 0,
      level: stats.level ?? 1,
      streak_current: stats.streak_current ?? 0,
      streak_best: profile?.streak_best ?? 0,
    };
  }

  // 2) Fallback: usar profiles
  return {
    xp_total: profile?.xp_total ?? 0,
    level: profile?.level ?? 1,
    streak_current: profile?.streak_current ?? 0,
    streak_best: profile?.streak_best ?? 0,
  };
}

function createActiveCourseCard(courseObj, lastDayMap) {
  const wrapper = document.createElement("article");
  wrapper.className = "course-card";

  const course = courseObj.courses;
  const courseId = course.id;

  const cover =
    course.cover_url || "https://via.placeholder.com/600x300.png?text=Advance%2B";

  const totalDays = course.duration_days || course.duration || 1;
  const lastDay = lastDayMap[courseId] || 0;
  const nextDay = Math.min(lastDay + 1, totalDays);

  wrapper.innerHTML = `
    <div class="course-cover-wrapper">
      <img src="${cover}" alt="${course.title}" class="course-cover" />
      <span class="course-badge">${course.category || "Reto"}</span>
    </div>
    <div class="course-body">
      <div class="course-title">${course.title}</div>
      <div class="course-day">Día ${nextDay} de ${totalDays}</div>
      <div class="course-actions">
        <button class="btn-continue">Continuar</button>
      </div>
    </div>
  `;

  const btnContinue = wrapper.querySelector(".btn-continue");
  btnContinue.addEventListener("click", () => {
    window.location.href = `/leccion/index.html?course=${courseId}&day=${nextDay}`;
  });

  return wrapper;
}

function createAvailableCourseCard(course) {
  const wrapper = document.createElement("article");
  wrapper.className = "course-card";

  const cover =
    course.cover_url || "https://via.placeholder.com/600x300.png?text=Advance%2B";

  wrapper.innerHTML = `
    <div class="course-cover-wrapper">
      <img src="${cover}" alt="${course.title}" class="course-cover" />
      <span class="course-badge">${course.category || "Reto"}</span>
    </div>
    <div class="course-body">
      <div class="course-title">${course.title}</div>
      <div class="course-meta">${course.level || "Todos los niveles"}</div>
      <div class="course-actions">
        <button class="btn-secondary">Ver detalles</button>
      </div>
    </div>
  `;

  const btnDetails = wrapper.querySelector(".btn-secondary");
  btnDetails.addEventListener("click", () => {
    alert("Próximamente: detalles del curso.");
  });

  return wrapper;
}

async function loadDashboard() {
  // 1. Usuario autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  // 2. Perfil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error cargando perfil:", profileError);
  }

  setText("userName", profile?.display_name || profile?.full_name || user.email);
  setText(
    "userRole",
    profile?.role === "coach"
      ? "Coach Advance+"
      : profile?.role === "admin"
      ? "Admin Advance+"
      : "Miembro Advance+"
  );
  renderAvatar(profile);

  // 3. Gamificación (user_stats -> fallback profiles)
  const gamification = await fetchGamification(user.id, profile);
  renderGamification(gamification);

  // 4. Cursos activos
  const { data: active, error: activeError } = await supabase
    .from("user_courses")
    .select(
      "course_id, started_at, courses ( id, title, slug, description, category, level, duration_days, duration, cover_url )"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (activeError) {
    console.error("Error cargando cursos activos:", activeError);
  }

  // 5. Progreso por curso (último día completado)
  const { data: progressRows, error: progressError } = await supabase
    .from("progress")
    .select("course_id, day")
    .eq("user_id", user.id);

  if (progressError) {
    console.error("Error cargando progreso:", progressError);
  }

  const lastDayByCourse = {};
  (progressRows || []).forEach((row) => {
    const current = lastDayByCourse[row.course_id] || 0;
    if (row.day > current) lastDayByCourse[row.course_id] = row.day;
  });

  const activeGrid = document.getElementById("activeCoursesGrid");
  const activeCountEl = document.getElementById("activeCount");
  const noActiveMessage = document.getElementById("noActiveMessage");

  activeGrid.innerHTML = "";

  if (active && active.length > 0) {
    active.forEach((uc) => {
      if (!uc.courses) return;
      const card = createActiveCourseCard(uc, lastDayByCourse);
      activeGrid.appendChild(card);
    });
    if (activeCountEl) activeCountEl.textContent = `${active.length} retos activos`;
    if (noActiveMessage) noActiveMessage.style.display = "none";
  } else {
    if (activeCountEl) activeCountEl.textContent = "0 retos activos";
    if (noActiveMessage) noActiveMessage.style.display = "block";
  }

  // 6. Cursos disponibles (no inscritos)
  const { data: allActiveCourses, error: coursesError } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  if (coursesError) {
    console.error("Error cargando cursos disponibles:", coursesError);
  }

  const activeIds = new Set((active || []).map((uc) => uc.course_id));
  const available = (allActiveCourses || []).filter((c) => !activeIds.has(c.id));

  const availableGrid = document.getElementById("availableCoursesGrid");
  const noAvailableMessage = document.getElementById("noAvailableMessage");

  availableGrid.innerHTML = "";

  if (available && available.length > 0) {
    available.forEach((course) => {
      const card = createAvailableCourseCard(course);
      availableGrid.appendChild(card);
    });
    if (noAvailableMessage) noAvailableMessage.style.display = "none";
  } else {
    if (noAvailableMessage) noAvailableMessage.style.display = "block";
  }

  // 7. Logout (por si no lo tenías ya en otro archivo)
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/index.html";
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard().catch((err) => console.error("Error en dashboard:", err));
});

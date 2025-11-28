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

  // Iniciales como fallback
  const name = profile?.display_name || profile?.full_name || profile?.email || "A+";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  avatarContainer.textContent = initials;
}

function renderGamification(profile) {
  const xp = profile?.xp_total ?? 0;
  const level = profile?.level ?? 1;
  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;

  setText("levelLabel", level);
  setText("xpTotalLabel", `${xp} XP`);
  setText("xpNextLabel", `${xpToNext} XP para el siguiente nivel`);
  setText("streakCurrent", `${profile?.streak_current ?? 0} 🔥`);
  setText("streakBest", `${profile?.streak_best ?? 0} 🏆`);

  const xpBarFill = document.getElementById("xpBarFill");
  if (xpBarFill) {
    const percent = Math.min(100, (xpInLevel / 100) * 100);
    // pequeño delay para que la transición se vea
    setTimeout(() => {
      xpBarFill.style.width = `${percent}%`;
    }, 150);
  }
}

function createActiveCourseCard(courseObj, lastDayMap) {
  const wrapper = document.createElement("article");
  wrapper.className = "course-card"; // ya no hace falta clickable aquí

  const course = courseObj.courses;
  const courseId = course.id;

  const cover =
    course.cover_url || "https://via.placeholder.com/600x300.png?text=Advance%2B";
  const totalDays = course.duration || 1;
  const lastDay = lastDayMap[courseId] || 0;
  const nextDay = Math.min(lastDay + 1, totalDays);

  // guardamos datos en atributos del DOM
  wrapper.dataset.courseId = courseId;
  wrapper.dataset.nextDay = String(nextDay);

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

  return wrapper;
}

function createActiveCourseCard(courseObj, lastDayMap) {
  const wrapper = document.createElement("article");
  wrapper.className = "course-card";

  const course = courseObj.courses;
  const courseId = course.id;

  const cover = course.cover_url ||
    "https://via.placeholder.com/600x300.png?text=Advance%2B";

  const totalDays = course.duration || 1;
  const lastDay = lastDayMap[courseId] || 0;
  const nextDay = Math.min(lastDay + 1, totalDays);

  // Guardamos datos para delegación
  wrapper.dataset.courseId = courseId;
  wrapper.dataset.nextDay = nextDay;

  wrapper.innerHTML = `
    <div class="course-cover-wrapper">
      <img src="${cover}" alt="${course.title}" class="course-cover" />
      <span class="course-badge">${course.category || "Reto"}</span>
    </div>

    <div class="course-body">
      <div class="course-title">${course.title}</div>
      <div class="course-day">Día ${nextDay} de ${totalDays}</div>
    </div>
  `;

  // HACER TODA LA TARJETA CLIQUEABLE
  wrapper.addEventListener("click", () => {
    window.location.href = `/leccion/index.html?course=${courseId}&day=${nextDay}`;
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

  // Header
  setText("userName", profile?.display_name || profile?.full_name || user.email);
  setText("userRole", profile?.role === "coach" ? "Coach Advance+" :
                       profile?.role === "admin" ? "Admin Advance+" :
                       "Miembro Advance+");
  renderAvatar(profile);
  renderGamification(profile);

  // 3. Cursos activos
  const { data: active, error: activeError } = await supabase
    .from("user_courses")
    .select("course_id, start_date, courses ( id, title, slug, description, category, level, duration, cover_url )")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  if (activeError) {
    console.error("Error cargando cursos activos:", activeError);
  }

  // 4. Progreso por curso (último día completado)
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

   // Delegación de click para TODA la tarjeta
  if (!activeGrid.dataset.clickBound) {
    activeGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".course-card");
      if (!card) return;

      const courseId = card.dataset.courseId;
      const nextDay = card.dataset.nextDay || "1";

      if (!courseId) return;

      // misma ruta que el botón continuar
      window.location.href = `/leccion/index.html?course=${courseId}&day=${nextDay}`;
    });

    // marca para no duplicar el listener
    activeGrid.dataset.clickBound = "1";
  }
 

  // 5. Cursos disponibles (no inscritos)
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

  // 6. Logout
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

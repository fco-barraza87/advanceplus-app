// /js/course-index.js
import { supabase } from "/js/supabase.js";

const qs = (sel) => document.querySelector(sel);

/* ==================================================
   1. OBTENER USUARIO ACTUAL
================================================== */
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/* ==================================================
   2. CARGAR RETOS ACTIVOS DEL USUARIO
================================================== */
async function loadActiveCourses(userId) {
  const { data: userCourses, error } = await supabase
    .from("user_courses")
    .select("course_id, status, started_at, progress_pct")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error cargando user_courses", error);
    return [];
  }

  const list = [];

  for (const uc of userCourses || []) {
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, short_promise, category, level, duration_days, cover_url, active")
      .eq("id", uc.course_id)
      .single();

    if (courseError) {
      console.warn("Error cargando course", courseError);
      continue;
    }

    if (course?.active !== false) {
      list.push({
        ...course,
        progress_pct: uc.progress_pct ?? 0,
      });
    }
  }

  return list;
}

/* ==================================================
   3. CARGAR TODOS LOS RETOS DISPONIBLES
================================================== */
async function loadAllCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      short_promise,
      category,
      level,
      duration_days,
      hero_image_url,
      thumbnail_url,
      cover_url,
      badge_text,
      price_chf,
      sale_price_chf,
      reviews_average,
      reviews_count,
      active
    `)
    .eq("active", true);

  if (error) {
    console.error("Error cargando courses", error);
    return [];
  }

  return data || [];
}

/* ==================================================
   4. RENDER — TARJETA DE CURSO (REUTILIZABLE)
================================================== */
function createCourseCard(course, { showProgress = false } = {}) {
  const card = document.createElement("article");
  card.className = "course-card";

  const cover =
    course.hero_image_url ||
    course.thumbnail_url ||
    course.cover_url ||
    "https://via.placeholder.com/600x300?text=A+";

  const priceBlock =
    course.sale_price_chf || course.price_chf
      ? `
    <div class="course-price">
      ${
        course.sale_price_chf
          ? `<del>${course.price_chf} CHF</del> ${course.sale_price_chf} CHF`
          : `${course.price_chf || 0} CHF`
      }
    </div>`
      : "";

  const progressBlock =
    showProgress && typeof course.progress_pct === "number"
      ? `
    <div class="course-progress-row">
      <div class="course-progress-label">
        Progreso: ${Math.round(course.progress_pct)}%
      </div>
      <div class="course-progress-bar">
        <div class="course-progress-fill" style="width:${Math.min(
          100,
          course.progress_pct
        )}%;"></div>
      </div>
    </div>`
      : "";

  card.innerHTML = `
    <div class="course-cover" style="
      background-image:url('${cover}');
      background-size:cover;
      background-position:center;
    "></div>

    <h3 class="course-title">${course.title}</h3>

    ${
      course.short_promise
        ? `<p class="course-desc">${course.short_promise}</p>`
        : ""
    }

    <div class="course-meta-row">
      ${
        course.category
          ? `<span class="course-pill">${course.category}</span>`
          : ""
      }
      ${
        course.level
          ? `<span class="course-pill">${course.level}</span>`
          : ""
      }
      ${
        course.duration_days
          ? `<span class="course-pill">${course.duration_days} días</span>`
          : ""
      }
    </div>

    ${priceBlock}
    ${progressBlock}
  `;

  // TODO: luego conectamos con lesson.html o página de detalle
  card.onclick = () => {
    // Por ahora, enviamos al curso en modo simple
    window.location.href = `/curso/index.html?c=${course.id}`;
  };

  return card;
}

/* ==================================================
   5. RENDER — LISTAS
================================================== */
function renderActiveCourses(courses) {
  const grid = qs("#activeCoursesGrid");
  const empty = qs("#noActiveCoursesMessage");
  const count = qs("#activeCoursesCount");

  if (!grid || !empty || !count) return;

  grid.innerHTML = "";

  if (!courses.length) {
    empty.style.display = "block";
    count.textContent = "0 activos";
    return;
  }

  empty.style.display = "none";
  count.textContent = `${courses.length} activo${
    courses.length > 1 ? "s" : ""
  }`;

  courses.forEach((course) => {
    const card = createCourseCard(course, { showProgress: true });
    grid.appendChild(card);
  });
}

function renderAllCourses(courses) {
  const grid = qs("#allCoursesGrid");
  const empty = qs("#noCoursesMessage");

  if (!grid || !empty) return;

  grid.innerHTML = "";

  if (!courses.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  courses.forEach((course) => {
    const card = createCourseCard(course, { showProgress: false });
    grid.appendChild(card);
  });
}

/* ==================================================
   6. INIT
================================================== */
async function initCoursesPage() {
  const user = await getCurrentUser();
  if (!user) return;

  // 1. Retos activos
  const activeCourses = await loadActiveCourses(user.id);
  renderActiveCourses(activeCourses);

  // 2. Todos los retos (catálogo)
  const allCourses = await loadAllCourses();
  renderAllCourses(allCourses);
}

initCoursesPage();

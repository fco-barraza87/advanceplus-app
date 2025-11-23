/* ============================================================
   PERFIL ADVANCE+ — Modular
============================================================ */

import { supabase } from "/js/supabase.js";

/* ============================================================
   🔹 Función para obtener datos desde la tabla profiles
============================================================ */
async function getProfile() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return null;

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

/* ============================================================
   🔹 Rellenar HEADER del perfil
============================================================ */
async function renderHeaderProfile() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  document.getElementById("profile-name").textContent =
    profile?.full_name || user.email.split("@")[0];

  document.getElementById("profile-email").textContent =
    profile?.email || user.email;

  // Avatar iniciales
  const initials = (profile?.full_name || user.email)
    .split(" ")
    .map((x) => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.getElementById("profile-avatar").textContent = initials;
}

/* ============================================================
   🔹 Rellenar FORMULARIO de datos personales
============================================================ */
async function fillDatosForm() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  document.getElementById("inputFullName").value = profile?.full_name || "";
  document.getElementById("inputEmail").value = profile?.email || user.email;
  document.getElementById("inputPais").value = profile?.pais || "";
  document.getElementById("inputIdioma").value = profile?.idioma || "es";

  if (profile?.nacimiento)
    document.getElementById("inputNacimiento").value = profile.nacimiento;
}

async function loadModule(page) {
  const container = document.getElementById("content");

  try {
    const response = await fetch(`/perfil/${page}.html`);
    container.innerHTML = await response.text();

    // Si cargamos datos.html → rellenar formulario
    if (page === "datos") {
      await fillDatosForm();
    }

    // Si cargamos preferencias.html → inicializar módulo preferencias
    if (page === "preferencias") {
      await initPreferencias();
    }

    // Si cargamos cursos.html → inicializar módulo mis cursos
    if (page === "cursos") {
      await initCursos();
    }

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 20px; color: #ff6b6b;">
        Error cargando el módulo <strong>${page}</strong>.
      </div>
    `;
  }
}

/* ============================================================
   🔹 Activar clase active
============================================================ */
function initMenu() {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      menuItems.forEach((el) => el.classList.remove("active"));
      item.classList.add("active");

      const page = item.dataset.page;
      loadModule(page);
    });
  });
}

/* ============================================================
   🚀 Inicializar
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await renderHeaderProfile();
  initMenu();
  loadModule("datos");
});

/* ============================================================
   🔹 Guardar cambios del formulario Datos Personales (dinámico)
============================================================ */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-datos") return;
  e.preventDefault();

  const msg = document.getElementById("datosMsg");
  msg.textContent = "Guardando...";

  // Obtener usuario autenticado
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    msg.textContent = "❌ No hay usuario autenticado.";
    msg.style.color = "#ff6b6b";
    return;
  }

  // Leer valores del formulario
  const fullName = document.getElementById("inputFullName").value.trim();
  const pais = document.getElementById("inputPais").value.trim();
  const idioma = document.getElementById("inputIdioma").value.trim();
  const birthdate = document.getElementById("inputNacimiento").value.trim();

  // Construcción dinámica del objeto updates
  const updates = {};

  if (fullName) updates.full_name = fullName;
  if (pais) updates.pais = pais;
  if (idioma) updates.idioma = idioma;
  if (birthdate) updates.birthdate = birthdate;

  // Si no hay nada que actualizar → igual mostramos éxito
  if (Object.keys(updates).length === 0) {
    msg.style.color = "#3ee98a";
    msg.textContent = "✔ Nada que actualizar";
    return;
  }

  updates.updated_at = new Date();

  // Actualizar en tabla profiles
  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  msg.style.color = updateError ? "#ff6b6b" : "#3ee98a";
  msg.textContent = updateError
    ? "❌ Error guardando"
    : "✔ Cambios guardados con éxito";
});


/* ============================================================
   🔹 Inicializar módulo de PREFERENCIAS
   Lee de profiles.notifications (y fallback a user_metadata.prefs)
============================================================ */
async function initPreferencias() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  // 1) Preferencias desde profiles.notifications
  // 2) Si está vacío, usamos fallback desde auth.user_metadata.prefs
  const prefs =
    profile?.notifications && Object.keys(profile.notifications).length > 0
      ? profile.notifications
      : user.user_metadata?.prefs || {};

  // Setear valores con defaults elegantes
  const elModoExpress = document.getElementById("modoExpress");
  const elNotifDiarias = document.getElementById("notifDiarias");
  const elNotifRacha = document.getElementById("notifRacha");
  const elTemaVisual = document.getElementById("temaVisual");
  const elPrivNombre = document.getElementById("privNombre");
  const msg = document.getElementById("prefMsg");

  if (!elModoExpress || !elNotifDiarias || !elNotifRacha || !elTemaVisual || !elPrivNombre) {
    console.warn("⚠ Elementos de preferencias no encontrados en el DOM.");
    return;
  }

  elModoExpress.checked = prefs.modoExpress ?? true;
  elNotifDiarias.checked = prefs.notifDiarias ?? true;
  elNotifRacha.checked = prefs.notifRacha ?? true;
  elTemaVisual.value = prefs.temaVisual || "auto";
  elPrivNombre.checked = prefs.privNombre ?? true;

  // Handler de guardado
  const form = document.getElementById("form-preferencias");
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    if (msg) {
      msg.textContent = "Guardando...";
      msg.style.color = "#fff";
    }

    const newPrefs = {
      modoExpress: elModoExpress.checked,
      notifDiarias: elNotifDiarias.checked,
      notifRacha: elNotifRacha.checked,
      temaVisual: elTemaVisual.value,
      privNombre: elPrivNombre.checked
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        notifications: newPrefs,
        updated_at: new Date()
      })
      .eq("id", user.id);

    if (msg) {
      msg.style.color = updateError ? "#ff6b6b" : "#3ee98a";
      msg.textContent = updateError
        ? "❌ Error guardando preferencias"
        : "✔ Preferencias guardadas";
    }
  };
}

/* ============================================================
   🔹 Inicializar módulo MIS CURSOS
   Usa: user_courses + courses + progress (para métricas)
============================================================ */
async function initCursos() {
  const data = await getProfile();
  if (!data) return;

  const { user } = data;

  const container = document.getElementById("coursesContainer");
  const emptyMsg = document.getElementById("coursesEmpty");
  const activeEl = document.getElementById("coursesActiveCount");
  const completedEl = document.getElementById("coursesCompletedCount");
  const xpTotalEl = document.getElementById("coursesXpTotal");

  if (!container) {
    console.warn("⚠ No se encontró #coursesContainer en cursos.html");
    return;
  }

  // Estado inicial
  container.innerHTML = `
    <div class="card" style="grid-column: 1 / -1; text-align:center; padding:18px;">
      <div class="card-label">Cargando cursos...</div>
    </div>
  `;
  if (emptyMsg) emptyMsg.style.display = "none";

  /* ================================
     1) Traer cursos del usuario
  ================================= */
  const { data: userCourses, error: ucError } = await supabase
    .from("user_courses")
    .select(`
      id,
      status,
      started_at,
      completed_at,
      progress_pct,
      xp_gained,
      course:courses (
        id,
        title,
        slug,
        description,
        category,
        level,
        cover_url,
        duration_days,
        xp_reward
      )
    `)
    .eq("user_id", user.id)
    .order("started_at", { ascending: true });

  if (ucError) {
    console.error("Error cargando user_courses:", ucError);
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; padding:18px; color:#ff6b6b;">
        ❌ Error cargando tus cursos. Intenta nuevamente más tarde.
      </div>
    `;
    return;
  }

  if (!userCourses || userCourses.length === 0) {
    container.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    if (activeEl) activeEl.textContent = "0";
    if (completedEl) completedEl.textContent = "0";
    if (xpTotalEl) xpTotalEl.textContent = "0";
    return;
  }

  /* ================================
     2) Traer progreso de todos los cursos del usuario
  ================================= */
  const { data: progressRows, error: progError } = await supabase
    .from("progress")
    .select("course_id, day, completed, xp, streak")
    .eq("user_id", user.id);

  if (progError) {
    console.error("Error cargando progress:", progError);
  }

  const progressByCourse = {};
  (progressRows || []).forEach((row) => {
    if (!row.course_id) return;
    if (!progressByCourse[row.course_id]) {
      progressByCourse[row.course_id] = [];
    }
    progressByCourse[row.course_id].push(row);
  });

  /* ================================
     3) Procesar métricas agregadas
  ================================= */
  let activeCount = 0;
  let completedCount = 0;
  let xpTotal = 0;

  const cardsHtml = userCourses
    .map((uc, index) => {
      const course = uc.course;
      if (!course) return "";

      const courseId = course.id;
      const prog = progressByCourse[courseId] || [];

      // Total de "lecciones" (asumimos duration_days como referencia)
      const totalLessons = course.duration_days || (prog.length ? Math.max(...prog.map(p => p.day || 0)) : null);

      // Último día tocado / completado
      const lastDay = prog.length ? Math.max(...prog.map(p => p.day || 0)) : null;
      const lastCompletedDay = prog
        .filter(p => p.completed)
        .reduce((max, p) => (p.day > max ? p.day : max), 0);

      // Racha del curso (max streak)
      const streak = prog.length
        ? prog.reduce((max, p) => Math.max(max, p.streak || 0), 0)
        : 0;

      const status = uc.status || (uc.completed_at ? "completed" : "active");

      if (status === "active") activeCount++;
      if (status === "completed") completedCount++;

      const xpGained = uc.xp_gained || 0;
      xpTotal += xpGained;

      const progressPct = typeof uc.progress_pct === "number" ? uc.progress_pct : 0;

      // Textos derivados
      const statusLabel =
        status === "completed"
          ? "Completado"
          : status === "active"
          ? "En progreso"
          : "Activo";

      const lastLessonText = lastCompletedDay
        ? `Última lección: Día ${lastCompletedDay}`
        : lastDay
        ? `Última actividad: Día ${lastDay}`
        : "Aún no has comenzado";

      const totalLessonsText = totalLessons
        ? `${totalLessons} lecciones`
        : "Lecciones dinámicas";

      const startedAt = uc.started_at
        ? new Date(uc.started_at).toLocaleDateString("es-ES")
        : null;

      const completedAt = uc.completed_at
        ? new Date(uc.completed_at).toLocaleDateString("es-ES")
        : null;

      const chipDate = status === "completed"
        ? (completedAt ? `Completado el ${completedAt}` : "Curso completado")
        : (startedAt ? `Desde el ${startedAt}` : "Curso activo");

      // Card HTML
      return `
        <article class="course-card" style="animation-delay:${index * 60}ms">
          <div class="course-cover-wrapper">
            <img
              src="${course.cover_url}"
              alt="${course.title}"
              class="course-cover"
              loading="lazy"
            />
            <div class="course-badge">
              ${course.category} • ${course.level}
            </div>
          </div>

          <div class="course-body">
            <div class="card-header-row">
              <div>
                <h3 class="course-title">${course.title}</h3>
                <p class="course-meta">${course.subtitle || course.description}</p>
              </div>
              <span class="course-day">${statusLabel}</span>
            </div>

            <div class="xp-row">
              <div class="xp-info">
                <span class="xp-total">Progreso: ${progressPct}%</span>
                <span>${totalLessonsText}</span>
              </div>
              <div class="xp-bar">
                <div class="xp-bar-fill" style="width: ${Math.min(
                  Math.max(progressPct, 0),
                  100
                )}%"></div>
              </div>
            </div>

            <div class="xp-info" style="margin-top:10px;">
              <span>${lastLessonText}</span>
              <span>Racha: ${streak} 🔥</span>
            </div>

            <div class="xp-info" style="margin-top:4px;">
              <span>${chipDate}</span>
              <span>XP curso: ${xpGained}</span>
            </div>

            <div class="course-actions" style="margin-top:12px; display:flex; gap:8px;">
              <button
                type="button"
                class="btn-continue"
                data-course-id="${course.id}"
              >
                Continuar
              </button>

                <!-- REPETIR DESDE EL INICIO -->
              <button
                type="button"
                class="btn-secondary btn-restart"
                data-course-id="${courseId}"
              >
                Volver desde el Inicio
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  container.innerHTML = cardsHtml;

  // Resumen superior
  if (activeEl) activeEl.textContent = String(activeCount);
  if (completedEl) completedEl.textContent = String(completedCount);
  if (xpTotalEl) xpTotalEl.textContent = String(xpTotal);

  if (emptyMsg) {
    emptyMsg.style.display = userCourses.length === 0 ? "block" : "none";
  }

/* ================================
   4) Acciones de botones (auto-día)
================================ */
container.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-course-id]");
  if (!btn) return;

  const courseId = btn.dataset.courseId;
  const action = btn.classList.contains("btn-continue") ? "continue" : "view";

  // 1) Cargar progreso del usuario para ese curso
  const { data: progressRows, error } = await supabase
    .from("progress")
    .select("day, completed")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .order("day", { ascending: true });

  let nextDay = 1;

  if (!error && progressRows?.length) {
    const completedDays = progressRows.filter((p) => p.completed);

    if (completedDays.length > 0) {
      const lastDone = completedDays[completedDays.length - 1].day;
      nextDay = lastDone + 1;
    }
  }

  // 2) Traer total de días del curso
  const { data: course } = await supabase
    .from("courses")
    .select("duration_days")
    .eq("id", courseId)
    .single();

  if (nextDay > course.duration_days) {
    nextDay = course.duration_days;
  }

  // 3) Redirigir correctamente
  window.location.href = `/curso/index.html?c=${courseId}&day=${nextDay}`;
});


// CLICK: Repetir desde el inicio (solo redirigir al día 1)
container.addEventListener("click", (e) => {
  const restartBtn = e.target.closest(".btn-restart");
  if (!restartBtn) return;

  const courseId = restartBtn.dataset.courseId;
  window.location.href = `/curso/index.html?c=${courseId}&day=1`;
});


}


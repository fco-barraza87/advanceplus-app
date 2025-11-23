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

    if (page === "avatar") {
      const module = await import("/perfil/js/avatar.js");
      module.initAvatar();
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
   🔥 initCursos() — versión optimizada
   Sin listeners duplicados, sin colisiones y más eficiente.
============================================================ */

async function initCursos() {
  const data = await getProfile();
  if (!data) return;

  const { user } = data;

  const container     = document.getElementById("coursesContainer");
  const emptyMsg      = document.getElementById("coursesEmpty");
  const activeEl      = document.getElementById("coursesActiveCount");
  const completedEl   = document.getElementById("coursesCompletedCount");
  const xpTotalEl     = document.getElementById("coursesXpTotal");

  if (!container) return;

  container.innerHTML = `
    <div class="card" style="grid-column: 1 / -1; text-align:center; padding:18px;">
      <div class="card-label">Cargando cursos...</div>
    </div>
  `;
  if (emptyMsg) emptyMsg.style.display = "none";

  /* ============================================================
     1) Traer cursos del usuario con join a courses
  ============================================================= */
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
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; padding:18px; color:#ff6b6b;">
        ❌ Error cargando tus cursos.
      </div>
    `;
    return;
  }

  if (!userCourses || userCourses.length === 0) {
    container.innerHTML = "";
    emptyMsg.style.display = "block";
    activeEl.textContent = "0";
    completedEl.textContent = "0";
    xpTotalEl.textContent = "0";
    return;
  }

  /* ============================================================
     2) Traer progreso completo agrupado por curso
  ============================================================= */
  const { data: progRows } = await supabase
    .from("progress")
    .select("course_id, day, completed, xp, streak")
    .eq("user_id", user.id);

  const progressByCourse = {};
  (progRows || []).forEach(p => {
    if (!progressByCourse[p.course_id]) progressByCourse[p.course_id] = [];
    progressByCourse[p.course_id].push(p);
  });

  /* ============================================================
     3) Construir tarjetas + métricas
  ============================================================= */
  let activeCount = 0;
  let completedCount = 0;
  let xpTotal = 0;

  const cardsHtml = userCourses.map((uc, idx) => {
    const course = uc.course;
    if (!course) return "";

    const cId = course.id;
    const prog = progressByCourse[cId] || [];

    const totalLessons   = course.duration_days;
    const completedDays  = prog.filter(p => p.completed);
    const lastCompleted  = completedDays.length ? completedDays.at(-1).day : 0;
    const lastDayTouched = prog.length ? Math.max(...prog.map(p => p.day)) : 0;

    const streak = prog.length
      ? Math.max(...prog.map(p => p.streak || 0))
      : 0;

    const status =
      uc.status ||
      (uc.completed_at ? "completed" : "active");

    if (status === "active") activeCount++;
    if (status === "completed") completedCount++;

    xpTotal += uc.xp_gained || 0;

    const progressPct = uc.progress_pct ?? 0;

    return `
      <article class="course-card" style="animation-delay:${idx * 60}ms">
        
        <div class="course-cover-wrapper">
          <img src="${course.cover_url}" class="course-cover" alt="${course.title}"/>
          <div class="course-badge">${course.category} • ${course.level}</div>
        </div>

        <div class="course-body">
          
          <div class="card-header-row">
            <div>
              <h3 class="course-title">${course.title}</h3>
              <p class="course-meta">${course.description || ""}</p>
            </div>
            <span class="course-day">
              ${status === "completed" ? "Completado" : "En progreso"}
            </span>
          </div>

          <div class="xp-row">
            <div class="xp-info">
              <span class="xp-total">Progreso: ${progressPct}%</span>
              <span>${totalLessons} lecciones</span>
            </div>
            <div class="xp-bar">
              <div class="xp-bar-fill" style="width:${progressPct}%"></div>
            </div>
          </div>

          <div class="xp-info" style="margin-top:10px;">
            <span>${lastCompleted ? `Última lección: Día ${lastCompleted}` : "Aún no has comenzado"}</span>
            <span>Racha: ${streak} 🔥</span>
          </div>

          <div class="xp-info" style="margin-top:4px;">
            <span>${uc.started_at ? `Desde el ${new Date(uc.started_at).toLocaleDateString("es-ES")}` : ""}</span>
            <span>XP curso: ${uc.xp_gained || 0}</span>
          </div>

          <div class="course-actions" style="margin-top:12px; display:flex; gap:8px;">
            <button class="btn-continue" data-course-id="${cId}">
              Continuar
            </button>

            <button class="btn-secondary btn-restart" data-course-id="${cId}">
              Volver desde el Inicio
            </button>
          </div>

        </div>

      </article>
    `;
  }).join("");

  container.innerHTML = cardsHtml;

  activeEl.textContent    = activeCount;
  completedEl.textContent = completedCount;
  xpTotalEl.textContent   = xpTotal;

  emptyMsg.style.display = userCourses.length === 0 ? "block" : "none";

  /* ============================================================
     4) Un único listener para CONTINUAR + REINICIAR
  ============================================================= */
  container.addEventListener("click", async (e) => {

    /* ---- 🔄 REINICIAR ---- */
    const restartBtn = e.target.closest(".btn-restart");
    if (restartBtn) {
      const courseId = restartBtn.dataset.courseId;
      return window.location.href = `/curso/index.html?c=${courseId}&day=1`;
    }

    /* ---- ▶ CONTINUAR ---- */
    const contBtn = e.target.closest(".btn-continue");
    if (!contBtn) return; // No es un botón válido

    const courseId = contBtn.dataset.courseId;

    // Traer progreso para calcular el siguiente día
    const { data: rows } = await supabase
      .from("progress")
      .select("day, completed")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .order("day", { ascending: true });

    let nextDay = 1;

    if (rows?.length) {
      const completedRows = rows.filter(r => r.completed);
      if (completedRows.length > 0) {
        nextDay = completedRows.at(-1).day + 1;
      }
    }

    // Traer total del curso
    const { data: c } = await supabase
      .from("courses")
      .select("duration_days")
      .eq("id", courseId)
      .single();

    if (nextDay > c.duration_days) nextDay = c.duration_days;

    window.location.href = `/curso/index.html?c=${courseId}&day=${nextDay}`;
  });
}

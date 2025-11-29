/* ============================================================
   PERFIL ADVANCE+ — Modular
============================================================ */

import { supabase } from "/js/supabase.js";

/* ============================================================
   🔹 Obtener perfil
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

  const initials = (profile?.full_name || user.email)
    .split(" ")
    .map((x) => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatarProfile = document.getElementById("profile-avatar");

  if (profile?.avatar_url) {
    // Header
    if (window.updateHeaderAvatar) {
      window.updateHeaderAvatar(profile.avatar_url, profile.full_name);
    }

    // Avatar del perfil (círculo grande arriba)
    if (avatarProfile) {
      avatarProfile.style.backgroundImage = `url('${profile.avatar_url}')`;
      avatarProfile.style.backgroundSize = "cover";
      avatarProfile.style.backgroundPosition = "center";
      avatarProfile.textContent = "";
    }
  } else {
    // Header fallback a iniciales
    if (window.updateHeaderAvatar) {
      window.updateHeaderAvatar(null, profile.full_name);
    }

    // Perfil fallback a iniciales
    if (avatarProfile) {
      avatarProfile.textContent = initials;
      avatarProfile.style.backgroundImage = "none";
    }
  }
}

/* ============================================================
   🔹 Cargar módulos dinámicos SIN romper avatar.js
============================================================ */
async function loadModule(page) {
  const container = document.getElementById("content");
  if (!container) return;

  try {
    const response = await fetch(`/perfil/${page}.html`);
    const html = await response.text();

    // Inserción correcta asegurando que el DOM se pinte
    container.innerHTML = "";
    container.insertAdjacentHTML("beforeend", html);

    // Inicializar módulos según página
    if (page === "datos") await fillDatosForm();
    if (page === "preferencias") await initPreferencias();
    if (page === "cursos") await initCursos();

    /* --------------------------------------------------------
       MUY IMPORTANTE:
       initAvatar() se carga solo DESPUÉS de que el DOM fue pintado.
    -------------------------------------------------------- */
    if (page === "avatar") {
      const module = await import("/perfil/js/avatar.js");

      // Espera microtask → DOM 100% renderizado
      requestAnimationFrame(() => {
        module.initAvatar();
      });
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div style="padding:20px; color:#ff6b6b">
        Error cargando el módulo <strong>${page}</strong>.
      </div>
    `;
  }
}

/* ============================================================
   🔹 Activar menú
============================================================ */
function initMenu() {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      menuItems.forEach((m) => m.classList.remove("active"));
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
   🔹 Formulario Datos
============================================================ */
async function fillDatosForm() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  // Ojo: en tu schema final usas country/language,
  // pero aquí mantengo los ids que ya tenías en el HTML.
  document.getElementById("inputFullName").value = profile?.full_name || "";
  document.getElementById("inputEmail").value = profile?.email || user.email;
  document.getElementById("inputPais").value = profile?.pais || "";
  document.getElementById("inputIdioma").value = profile?.idioma || "es";

  if (profile?.birthdate) {
    document.getElementById("inputNacimiento").value = profile.birthdate;
  }

}

/* ============================================================
   🔹 Guardar datos personales
============================================================ */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-datos") return;
  e.preventDefault();

  const msg = document.getElementById("datosMsg");
  msg.textContent = "Guardando...";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    msg.textContent = "❌ Usuario no autenticado.";
    msg.style.color = "#ff6b6b";
    return;
  }

  const fullName = document.getElementById("inputFullName").value.trim();
  const pais = document.getElementById("inputPais").value.trim();
  const idioma = document.getElementById("inputIdioma").value.trim();
  const birthdate = document.getElementById("inputNacimiento").value.trim();

  const updates = {};
  if (fullName) updates.full_name = fullName;
  if (pais) updates.pais = pais;
  if (idioma) updates.idioma = idioma;
  if (birthdate) updates.birthdate = birthdate;

  updates.updated_at = new Date();

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  msg.style.color = error ? "#ff6b6b" : "#3ee98a";
  msg.textContent = error ? "❌ Error" : "✔ Guardado";
});

/* ============================================================
   🔹 Preferencias
============================================================ */
async function initPreferencias() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  const prefs =
    profile?.notifications && Object.keys(profile.notifications).length > 0
      ? profile.notifications
      : user.user_metadata?.prefs || {};

  const elModo = document.getElementById("modoExpress");
  const elNotif = document.getElementById("notifDiarias");

  if (!elModo) return;

  elModo.checked = prefs.modoExpress ?? true;
  elNotif.checked = prefs.notifDiarias ?? true;

  const form = document.getElementById("form-preferencias");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById("prefMsg");
    msg.textContent = "Guardando...";

    const newPrefs = {
      modoExpress: elModo.checked,
      notifDiarias: elNotif.checked,
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        notifications: newPrefs,
        updated_at: new Date(),
      })
      .eq("id", user.id);

    msg.style.color = error ? "#ff6b6b" : "#3ee98a";
    msg.textContent = error ? "❌ Error" : "✔ Guardado";
  };
}

/* ============================================================
   🔹 Mis Cursos — usando user_courses + progress + user_stats
============================================================ */
async function initCursos() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const userId = session.user.id;

  // Elementos del DOM (por si faltan, salimos sin romper nada)
  const coursesContainer = document.getElementById("coursesContainer");
  const emptyMessage = document.getElementById("coursesEmpty");
  const elActive = document.getElementById("coursesActiveCount");
  const elCompleted = document.getElementById("coursesCompletedCount");
  const elXpTotal = document.getElementById("coursesXpTotal");

  if (!coursesContainer) return;

  // 1) Traer en paralelo:
  //    - Inscripciones del usuario
  //    - Progreso del usuario
  //    - XP total real (user_stats)
  const [
    { data: enrollments, error: enrollErr },
    { data: progress, error: progErr },
    { data: stats, error: statsErr },
  ] = await Promise.all([
    supabase
      .from("user_courses")
      .select("course_id,status")
      .eq("user_id", userId),
    supabase.from("progress").select("*").eq("user_id", userId),
    supabase
      .from("user_stats")
      .select("xp_total")
      .eq("user_id", userId)
      .single(),
  ]);

  if (enrollErr) console.warn("Error user_courses:", enrollErr);
  if (progErr) console.warn("Error progress:", progErr);
  if (statsErr) console.warn("Error user_stats:", statsErr);

  if (!enrollments || enrollments.length === 0) {
    coursesContainer.innerHTML = "";
    if (emptyMessage) emptyMessage.style.display = "block";
    if (elActive) elActive.textContent = "0";
    if (elCompleted) elCompleted.textContent = "0";
    if (elXpTotal) elXpTotal.textContent = stats?.xp_total || 0;
    return;
  }

  // 2) Traer datos de los cursos inscritos
  const courseIds = enrollments.map((e) => e.course_id);
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("*")
    .in("id", courseIds)
    .eq("active", true);

  if (coursesError) {
    console.warn("Error courses:", coursesError);
    return;
  }

  // 3) Agrupar progreso por course_id
  const progressByCourse = {};
  (progress || []).forEach((p) => {
    if (!p.course_id) return;
    if (!progressByCourse[p.course_id]) progressByCourse[p.course_id] = [];
    progressByCourse[p.course_id].push(p);
  });

  // 4) KPIs: activos / completados según user_courses
  let activeCount = 0;
  let completedCount = 0;

  enrollments.forEach((e) => {
    if (e.status === "completed") completedCount++;
    else activeCount++; // todo lo demás lo consideramos activo
  });

  const totalXP = stats?.xp_total || 0;

  if (elActive) elActive.textContent = activeCount;
  if (elCompleted) elCompleted.textContent = completedCount;
  if (elXpTotal) elXpTotal.textContent = totalXP;

  // 5) Pintar tarjetas
  coursesContainer.innerHTML = "";

  enrollments.forEach((enr) => {
    const course = courses.find((c) => c.id === enr.course_id);
    if (!course) return;

    const courseProg = progressByCourse[course.id] || [];
    const totalDays = course.duration_days || 0;
    const daysDone = courseProg.filter((d) => d.completed).length;
    const xpCourse = courseProg.reduce(
      (acc, x) => acc + (x.xp || 0),
      0
    );

    const card = document.createElement("div");
    card.className = "course-card clickable";
    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${course.cover_url}" class="course-cover" />
        <div class="course-badge">${course.category || ""}</div>
      </div>

      <div class="course-body">
        <h3 class="course-title">${course.title}</h3>
        <p class="course-meta">
          Día ${daysDone} de ${totalDays}
        </p>
        <p class="course-meta">
          XP ganado: ${xpCourse}
        </p>
        <div class="course-actions">
          <button class="btn-continue">Continuar</button>
        </div>
      </div>
    `;

  /* ------------------------------------------
     CLICK → Abrir curso en su día correspondiente
  ------------------------------------------- */
  card.addEventListener("click", async () => {

    // 1) Leer progreso del curso (ya creado por el trigger)
    const { data: progressRows, error } = await supabase
      .from("progress")
      .select("day, completed")
      .eq("user_id", session.user.id)
      .eq("course_id", course.id)
      .order("day", { ascending: true });

    let nextDay = 1;

    if (!error && progressRows?.length) {
      const completed = progressRows.filter((p) => p.completed);

      if (completed.length > 0) {
        const lastDone = completed[completed.length - 1].day;
        nextDay = lastDone + 1;
      }
    }

    // 2) Nunca pasar del total de días
    if (nextDay > totalDays) {
      nextDay = totalDays;
    }

    // 3) Redirigir al curso (ID, no slug)
    window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
  });

  coursesContainer.appendChild(card);
});

  // 6) Mensaje vacío
  if (emptyMessage) {
    emptyMessage.style.display =
      enrollments.length === 0 ? "block" : "none";
  }
}

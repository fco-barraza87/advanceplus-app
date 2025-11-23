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
    .map(x => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatarHeader = document.getElementById("headerAvatarImg");
  const avatarInitials = document.getElementById("headerAvatarInitials");
  const avatarProfile = document.getElementById("profile-avatar");

  if (profile?.avatar_url) {
    // Header
    window.updateHeaderAvatar(profile.avatar_url, profile.full_name);

    // Avatar del perfil (círculo grande arriba)
    if (avatarProfile) {
      avatarProfile.style.backgroundImage = `url('${profile.avatar_url}')`;
      avatarProfile.style.backgroundSize = "cover";
      avatarProfile.style.backgroundPosition = "center";
      avatarProfile.textContent = "";
    }
  } else {
    // Header fallback a iniciales
    window.updateHeaderAvatar(null, profile.full_name);

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

  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      menuItems.forEach(m => m.classList.remove("active"));
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

  document.getElementById("inputFullName").value = profile?.full_name || "";
  document.getElementById("inputEmail").value = profile?.email || user.email;
  document.getElementById("inputPais").value = profile?.pais || "";
  document.getElementById("inputIdioma").value = profile?.idioma || "es";

  if (profile?.nacimiento)
    document.getElementById("inputNacimiento").value = profile.nacimiento;
}

/* ============================================================
   🔹 Guardar datos personales
============================================================ */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-datos") return;
  e.preventDefault();

  const msg = document.getElementById("datosMsg");
  msg.textContent = "Guardando...";

  const { data: { user } } = await supabase.auth.getUser();
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
   🔹 Cursos — con progreso real desde progress + courses
============================================================ */
async function initCursos() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const userId = session.user.id;

  // 1) Obtener progreso del usuario
  const { data: progress, error: progError } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId);

  // 2) Obtener cursos
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("*")
    .eq("active", true);

  if (progError || coursesError) {
    console.warn("Error cargando cursos:", progError || coursesError);
    return;
  }

  const coursesContainer = document.getElementById("coursesContainer");
  const emptyMessage = document.getElementById("coursesEmpty");

  // Agrupar progreso por course_id
  const grouped = {};
  progress.forEach(p => {
    if (!grouped[p.course_id]) grouped[p.course_id] = [];
    grouped[p.course_id].push(p);
  });

  // KPIs
  let totalXP = 0;
  let activeCount = 0;
  let completedCount = 0;

  coursesContainer.innerHTML = "";

  courses.forEach(course => {
    const courseProg = grouped[course.id] || [];

    if (courseProg.length === 0) return; // no está inscrito → no mostrarlo

    const totalDays = course.duration_days;
    const daysDone = courseProg.filter(d => d.completed).length;

    const isCompleted = daysDone === totalDays;
    const isActive = daysDone > 0 && !isCompleted;

    // XP acumulado del curso
    const xpCourse = courseProg.reduce((acc, x) => acc + (x.xp || 0), 0);
    totalXP += xpCourse;

    if (isCompleted) completedCount++;
    else if (isActive) activeCount++;

    // === CREAR TARJETA ===
    const card = document.createElement("div");
    card.className = "course-card clickable";
    card.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${course.cover_url}" class="course-cover" />
        <div class="course-badge">${course.category}</div>
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

    card.addEventListener("click", () => {
      window.location.href = `/curso/index.html?course=${course.slug}`;
    });

    coursesContainer.appendChild(card);
  });

  // Actualizar KPIs
  document.getElementById("coursesActiveCount").textContent = activeCount;
  document.getElementById("coursesCompletedCount").textContent = completedCount;
  document.getElementById("coursesXpTotal").textContent = totalXP;

  // Mostrar mensaje vacío si no tiene cursos
  if (activeCount + completedCount === 0) {
    emptyMessage.style.display = "block";
  } else {
    emptyMessage.style.display = "none";
  }
}

/* ============================================================
   PERFIL ADVANCE+ — Modular
============================================================ */

import { supabase } from "/js/supabase.js";

/* ============================================================
   🔹 Obtener perfil
============================================================ */
async function getProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error obteniendo usuario:", error);
    return null;
  }

  const user = data?.user;
  if (!user) return null;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profErr) {
    console.error("Error obteniendo perfil:", profErr);
    return { user, profile: null };
  }

  return { user, profile };
}

/* ============================================================
   🔹 Rellenar HEADER del perfil
============================================================ */
async function renderHeaderProfile() {
  const data = await getProfile();
  if (!data) return;

  const { user, profile } = data;

  const displayName = profile?.full_name || user.email.split("@")[0];

  const elName = document.getElementById("profile-name");
  const elEmail = document.getElementById("profile-email");
  const avatarProfile = document.getElementById("profile-avatar");

  if (elName) elName.textContent = displayName;
  if (elEmail) elEmail.textContent = profile?.email || user.email;

  const initials = (profile?.full_name || user.email)
    .split(" ")
    .map((x) => x[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  if (profile?.avatar_url) {
    // Header (avatar pequeño global)
    if (window.updateHeaderAvatar) {
      window.updateHeaderAvatar(profile.avatar_url, displayName);
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
      window.updateHeaderAvatar(null, displayName);
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

    container.innerHTML = "";
    container.insertAdjacentHTML("beforeend", html);

    // Inicializar módulos según página
    if (page === "datos") await fillDatosForm();
    if (page === "preferencias") await initPreferencias();
    if (page === "cursos") await initCursos();

    // Avatar: se inicializa solo cuando el DOM ya está pintado
    if (page === "avatar") {
      const module = await import("/perfil/js/avatar.js");
      requestAnimationFrame(() => {
        module.initAvatar();
      });
    }
  } catch (err) {
    console.error("Error cargando módulo", page, err);
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

  const inputFullName = document.getElementById("inputFullName");
  const inputEmail = document.getElementById("inputEmail");
  const inputPais = document.getElementById("inputPais");
  const inputIdioma = document.getElementById("inputIdioma");
  const inputNacimiento = document.getElementById("inputNacimiento");

  if (inputFullName)
    inputFullName.value = profile?.full_name || "";
  if (inputEmail)
    inputEmail.value = profile?.email || user.email;
  if (inputPais)
    inputPais.value = profile?.pais || "";
  if (inputIdioma)
    inputIdioma.value = profile?.idioma || "es";

  // Columna real en DB: birthdate (date)
  if (inputNacimiento && profile?.birthdate) {
    // Postgres date ya viene como "YYYY-MM-DD"
    inputNacimiento.value = profile.birthdate;
  }
}

/* ============================================================
   🔹 Guardar datos personales
============================================================ */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-datos") return;
  e.preventDefault();

  const msg = document.getElementById("datosMsg");
  if (!msg) return;
  msg.textContent = "Guardando...";
  msg.style.color = "#fff";

  const { data, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    console.error("Error auth:", authErr);
    msg.textContent = "❌ Error de autenticación";
    msg.style.color = "#ff6b6b";
    return;
  }

  const user = data?.user;
  if (!user) {
    msg.textContent = "❌ Usuario no autenticado.";
    msg.style.color = "#ff6b6b";
    return;
  }

  const fullName = document.getElementById("inputFullName")?.value.trim() ?? "";
  const pais = document.getElementById("inputPais")?.value.trim() ?? "";
  const idioma = document.getElementById("inputIdioma")?.value.trim() ?? "";
  const birthdateRaw = document.getElementById("inputNacimiento")?.value.trim() ?? "";

  // Normalizamos: si el campo está vacío, NO lo mandamos.
  const updates = {
    full_name: fullName,
    pais,
    idioma,
  };

  if (birthdateRaw !== "") {
    // Esperamos formato YYYY-MM-DD (input[type="date"])
    updates.birthdate = birthdateRaw;
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      console.error("Error actualizando perfil:", error, updates);
      msg.textContent = "❌ Error guardando";
      msg.style.color = "#ff6b6b";
    } else {
      msg.textContent = "✔ Guardado";
      msg.style.color = "#3ee98a";
    }
  } catch (err) {
    console.error("Excepción en update profiles:", err);
    msg.textContent = "❌ Error inesperado";
    msg.style.color = "#ff6b6b";
  }
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
  const form = document.getElementById("form-preferencias");

  if (!elModo || !form) return;

  elModo.checked = prefs.modoExpress ?? true;
  elNotif.checked = prefs.notifDiarias ?? true;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById("prefMsg");
    if (msg) {
      msg.textContent = "Guardando...";
      msg.style.color = "#fff";
    }

    const newPrefs = {
      modoExpress: elModo.checked,
      notifDiarias: elNotif.checked,
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notifications: newPrefs,
        })
        .eq("id", user.id);

      if (msg) {
        msg.style.color = error ? "#ff6b6b" : "#3ee98a";
        msg.textContent = error ? "❌ Error" : "✔ Guardado";
      }

      if (error) {
        console.error("Error guardando preferencias:", error);
      }
    } catch (err) {
      console.error("Excepción preferencias:", err);
      if (msg) {
        msg.textContent = "❌ Error inesperado";
        msg.style.color = "#ff6b6b";
      }
    }
  };
}

/* ============================================================
   🔹 Mis Cursos — usando user_courses + progress + user_stats
============================================================ */
async function initCursos() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    if (error) console.error("Error auth en cursos:", error);
    return;
  }

  const session = data;
  const userId = session.user.id;

  const coursesContainer = document.getElementById("coursesContainer");
  const emptyMessage = document.getElementById("coursesEmpty");
  const elActive = document.getElementById("coursesActiveCount");
  const elCompleted = document.getElementById("coursesCompletedCount");
  const elXpTotal = document.getElementById("coursesXpTotal");

  if (!coursesContainer) return;

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

  const progressByCourse = {};
  (progress || []).forEach((p) => {
    if (!p.course_id) return;
    if (!progressByCourse[p.course_id]) progressByCourse[p.course_id] = [];
    progressByCourse[p.course_id].push(p);
  });

  let activeCount = 0;
  let completedCount = 0;

  enrollments.forEach((e) => {
    if (e.status === "completed") completedCount++;
    else activeCount++;
  });

  const totalXP = stats?.xp_total || 0;

  if (elActive) elActive.textContent = activeCount;
  if (elCompleted) elCompleted.textContent = completedCount;
  if (elXpTotal) elXpTotal.textContent = totalXP;

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

    // CLICK → Abrir curso en su día correspondiente
    card.addEventListener("click", async () => {
      const { data: progressRows, error: progErr2 } = await supabase
        .from("progress")
        .select("day, completed")
        .eq("user_id", session.user.id)
        .eq("course_id", course.id)
        .order("day", { ascending: true });

      if (progErr2) {
        console.warn("Error leyendo progreso para continuar curso:", progErr2);
      }

      let nextDay = 1;

      if (!progErr2 && progressRows?.length) {
        const completed = progressRows.filter((p) => p.completed);
        if (completed.length > 0) {
          const lastDone = completed[completed.length - 1].day;
          nextDay = lastDone + 1;
        }
      }

      if (nextDay > totalDays) {
        nextDay = totalDays;
      }

      window.location.href = `/curso/index.html?c=${course.id}&day=${nextDay}`;
    });

    coursesContainer.appendChild(card);
  });

  if (emptyMessage) {
    emptyMessage.style.display =
      enrollments.length === 0 ? "block" : "none";
  }
}

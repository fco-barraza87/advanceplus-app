// /admin/js/admin-user-details.js
import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

// =======================
// Utils
// =======================

function getUserIdFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("id");
}

function formatDateValue(value) {
  if (!value) return "";
  // value puede venir como "2025-01-01T00:00:00+00:00"
  return value.split("T")[0];
}

// =======================
// Estado en memoria
// =======================

let currentUserId = null;
let currentStatsId = null;

// =======================
// Inicio
// =======================

init();

async function init() {
  await requireAdmin();

  currentUserId = getUserIdFromUrl();

  if (!currentUserId) {
    document.getElementById("userNotFound")?.classList.remove("hidden");
    return;
  }

  document.getElementById("userIdLabel").textContent = `ID: ${currentUserId}`;

  await Promise.all([
    loadProfile(),
    loadStats(),
    loadCourses()
  ]);

  setupListeners();
  loadAdminHeaderLabel();
}

// =======================
// Cargar perfil (profiles)
// =======================

async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUserId)
    .single();

  if (error || !data) {
    console.error("[admin] Error cargando perfil:", error);
    document.getElementById("userNotFound")?.classList.remove("hidden");
    return;
  }

  // Título y avatar
  document.getElementById("userNameTitle").textContent =
    data.full_name || "(Sin nombre)";

  document.getElementById("userAvatar").src =
    data.avatar_url || "/images/default-avatar.png";

  // Campos editables
  document.getElementById("fullNameInput").value = data.full_name || "";
  document.getElementById("emailInput").value = data.email || "";
  document.getElementById("roleSelect").value = data.role || "user";
  document.getElementById("countryInput").value = data.country || data.pais || "";
  document.getElementById("languageInput").value = data.language || data.idioma || "";
  document.getElementById("timezoneInput").value = data.timezone || "";
  document.getElementById("phoneInput").value = data.phone || "";
  document.getElementById("genderInput").value = data.gender || "";
  document.getElementById("birthdateInput").value = formatDateValue(data.birthdate);
  document.getElementById("coachingStyleInput").value = data.coaching_style || "";
  document.getElementById("learningStyleInput").value = data.learning_style || "";
  document.getElementById("themePreferenceInput").value = data.theme_preference || "auto";
  document.getElementById("bannerUrlInput").value = data.banner_url || "";
  document.getElementById("onboardingCheckbox").checked = !!data.onboarding_completed;
}

// =======================
// Cargar stats (user_stats)
// =======================

async function loadStats() {
  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", currentUserId)
    .single();

  if (error) {
    console.warn("[admin] user_stats no encontrados para este usuario:", error);
    // Mostramos 0s y salimos
    return;
  }

  currentStatsId = data.id;

  document.getElementById("statXpTotal").textContent = data.xp_total ?? 0;
  document.getElementById("statLevel").textContent = data.level ?? 1;
  document.getElementById("statStreakCurrent").textContent = data.streak_current ?? 0;
  document.getElementById("statStreakBest").textContent = data.streak_best ?? 0;
}

// =======================
// Cargar cursos del usuario
// user_courses + courses
// =======================

async function loadCourses() {
  // 1) user_courses para este user_id
  const { data: userCourses, error } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", currentUserId);

  if (error) {
    console.error("[admin] Error cargando user_courses:", error);
    return;
  }

  if (!userCourses || userCourses.length === 0) {
    document.getElementById("userCoursesEmpty").classList.remove("hidden");
    return;
  }

  const courseIds = [...new Set(userCourses.map(uc => uc.course_id).filter(Boolean))];

  if (courseIds.length === 0) {
    document.getElementById("userCoursesEmpty").classList.remove("hidden");
    return;
  }

  // 2) Traer info de cursos desde courses
  const { data: coursesData, error: coursesError } = await supabase
    .from("courses")
    .select("id, title, slug, category, level, active")
    .in("id", courseIds);

  if (coursesError) {
    console.error("[admin] Error cargando courses:", coursesError);
    return;
  }

  renderCourses(coursesData || []);
}

function renderCourses(courses) {
  const container = document.getElementById("userCoursesList");
  container.innerHTML = "";

  if (courses.length === 0) {
    document.getElementById("userCoursesEmpty").classList.remove("hidden");
    return;
  }

  document.getElementById("userCoursesEmpty").classList.add("hidden");

  courses.forEach(c => {
    const div = document.createElement("div");
    div.className = "user-course-card";

    div.innerHTML = `
      <div class="user-course-title">${c.title}</div>
      <div class="user-course-meta">
        <div>Slug: <code>${c.slug}</code></div>
        <div>Categoría: ${c.category ?? "-"}</div>
        <div>Nivel: ${c.level ?? "-"}</div>
        <div>Estado: ${c.active ? "Activo" : "Inactivo"}</div>
      </div>
    `;

    container.appendChild(div);
  });
}

// =======================
// Listeners de botones
// =======================

function setupListeners() {
  const saveBtn = document.getElementById("saveProfileBtn");
  const resetXpBtn = document.getElementById("resetXpBtn");
  const resetOnboardingBtn = document.getElementById("resetOnboardingBtn");
  const resetProgressBtn = document.getElementById("resetProgressBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", onSaveProfile);
  }

  if (resetXpBtn) {
    resetXpBtn.addEventListener("click", onResetXp);
  }

  if (resetOnboardingBtn) {
    resetOnboardingBtn.addEventListener("click", onResetOnboarding);
  }

  if (resetProgressBtn) {
    resetProgressBtn.addEventListener("click", onResetProgress);
  }

  const sidebarToggle = document.getElementById("sidebarToggle");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      document.querySelector(".admin-sidebar")?.classList.toggle("sidebar-closed");
      document.querySelector(".admin-header-bar")?.classList.toggle("header-shifted");
    });
  }

  const logoutBtn = document.getElementById("adminLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth/login.html";
    });
  }
}

// =======================
// Guardar cambios de perfil
// =======================

async function onSaveProfile() {
  const updates = {
    full_name: document.getElementById("fullNameInput").value || null,
    email: document.getElementById("emailInput").value || null,
    role: document.getElementById("roleSelect").value || "user",
    country: document.getElementById("countryInput").value || null,
    language: document.getElementById("languageInput").value || null,
    timezone: document.getElementById("timezoneInput").value || null,
    phone: document.getElementById("phoneInput").value || null,
    gender: document.getElementById("genderInput").value || null,
    birthdate: document.getElementById("birthdateInput").value || null,
    coaching_style: document.getElementById("coachingStyleInput").value || null,
    learning_style: document.getElementById("learningStyleInput").value || null,
    theme_preference: document.getElementById("themePreferenceInput").value || "auto",
    banner_url: document.getElementById("bannerUrlInput").value || null,
    onboarding_completed: document.getElementById("onboardingCheckbox").checked,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", currentUserId);

  if (error) {
    console.error("[admin] Error actualizando perfil:", error);
    alert("Error al guardar los cambios de perfil.");
    return;
  }

  document.getElementById("userNameTitle").textContent =
    updates.full_name || "(Sin nombre)";

  alert("Perfil actualizado correctamente.");
}

// =======================
// Reset XP y rachas
// =======================

async function onResetXp() {
  if (!currentStatsId) {
    alert("Este usuario no tiene registros en user_stats.");
    return;
  }

  const confirmReset = confirm(
    "¿Seguro que deseas resetear XP, racha actual, mejor racha y nivel a 1?"
  );
  if (!confirmReset) return;

  const { error } = await supabase
    .from("user_stats")
    .update({
      xp_total: 0,
      streak_current: 0,
      streak_best: 0,
      level: 1,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentStatsId);

  if (error) {
    console.error("[admin] Error reseteando user_stats:", error);
    alert("No se pudo resetear XP.");
    return;
  }

  await loadStats();
  alert("XP y rachas reseteadas.");
}

// =======================
// Reset onboarding
// =======================

async function onResetOnboarding() {
  const confirmReset = confirm(
    "¿Resetear onboarding (onboarding_completed = false) para este usuario?"
  );
  if (!confirmReset) return;

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: false,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentUserId);

  if (error) {
    console.error("[admin] Error reseteando onboarding:", error);
    alert("No se pudo resetear el onboarding.");
    return;
  }

  document.getElementById("onboardingCheckbox").checked = false;
  alert("Onboarding reseteado.");
}

// =======================
// Reset progreso completo
// (borra registros de progress por user_id)
// =======================

async function onResetProgress() {
  const confirmReset = confirm(
    "Esto eliminará TODO el progreso de este usuario en todos los cursos. ¿Continuar?"
  );
  if (!confirmReset) return;

  const { error } = await supabase
    .from("progress")
    .delete()
    .eq("user_id", currentUserId);

  if (error) {
    console.error("[admin] Error reseteando progreso:", error);
    alert("No se pudo resetear el progreso.");
    return;
  }

  alert("Progreso completo del usuario reseteado.");
}

// =======================
// Mostrar nombre del admin en header
// =======================

async function loadAdminHeaderLabel() {
  const label = document.getElementById("adminUserLabel");
  if (!label) return;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    label.textContent = "No autenticado";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", auth.user.id)
    .single();

  if (profile?.full_name) {
    label.textContent = profile.full_name;
  } else {
    label.textContent = auth.user.email ?? "Admin";
  }
}

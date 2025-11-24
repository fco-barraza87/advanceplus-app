// /admin/js/admin-index.js
console.log("¿Supabase existe?", window.supabase);


function getSupabaseClient() {
  if (window.supabase) return window.supabase;
  throw new Error(
    "No se encontró window.supabase. Asegúrate de inicializar Supabase antes de cargar admin-index.js"
  );
}

const supabase = getSupabaseClient();

let currentAdminProfile = null;

document.addEventListener("DOMContentLoaded", () => {
  initAdminDashboard().catch((err) => {
    console.error("Error inicializando dashboard admin:", err);
    showAccessWarning(
      "No se pudo inicializar el dashboard. Revisa la consola para más detalles."
    );
  });
});

async function initAdminDashboard() {
  await loadCurrentAdminProfile();
  updateLastUpdated();
  if (!currentAdminProfile) return;

  const role = currentAdminProfile.role;
  if (!["admin", "coach"].includes(role)) {
    showAccessWarning(
      "Tu rol no tiene acceso al Panel Admin. Solo se permite admin o coach."
    );
    return;
  }

  hideAccessWarning();

  await Promise.all([
    loadUserMetrics(),
    loadCourseMetrics(),
    loadProgressMetrics(),
  ]);
}

/* ---- Perfil actual / rol ---- */

async function loadCurrentAdminProfile() {
  const rolePill = document.getElementById("admin-role-pill");

  const {
    data: { session } = {},
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session || !session.user) {
    rolePill.textContent = "Sin sesión";
    showAccessWarning("No hay sesión activa. Inicia sesión para acceder al panel.");
    return;
  }

  const { user } = session;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    rolePill.textContent = "Error perfil";
    showAccessWarning(
      "No se pudo cargar tu perfil desde la tabla profiles. Verifica RLS/policies."
    );
    return;
  }

  currentAdminProfile = profile;

  rolePill.classList.remove("role-pill--admin", "role-pill--coach");
  if (profile.role === "admin") {
    rolePill.classList.add("role-pill--admin");
    rolePill.textContent = "Admin";
  } else if (profile.role === "coach") {
    rolePill.classList.add("role-pill--coach");
    rolePill.textContent = "Coach";
  } else {
    rolePill.textContent = profile.role || "Sin rol";
  }
}

/* ---- Access warning ---- */

function showAccessWarning(message) {
  const box = document.getElementById("access-warning");
  if (!box) return;
  box.classList.remove("access-warning--hidden");
  const p = box.querySelector("p");
  if (p) p.innerHTML = message;
}

function hideAccessWarning() {
  const box = document.getElementById("access-warning");
  if (!box) return;
  box.classList.add("access-warning--hidden");
}

/* ---- Last updated ---- */

function updateLastUpdated() {
  const el = document.getElementById("dashboard-last-updated");
  if (!el) return;
  const now = new Date();
  el.textContent =
    "Actualizado: " +
    now.toLocaleString("es-ES", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
}

/* ---- Métricas Usuarios ---- */

async function loadUserMetrics() {
  try {
    const [totalRes, activeRes, adminRes, coachRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("onboarding_completed", true),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "coach"),
    ]);

    setMetricValue("metric-total-users", totalRes.count);
    setMetricValue("metric-active-users", activeRes.count);
    setMetricValue("metric-admins", adminRes.count);
    setMetricValue("metric-coaches", coachRes.count);
  } catch (error) {
    console.error("Error cargando métricas de usuarios:", error);
  }
}

/* ---- Métricas Cursos ---- */

async function loadCourseMetrics() {
  try {
    const [totalRes, activeRes, prepRes, publicRes] = await Promise.all([
      supabase.from("courses").select("*", { count: "exact", head: true }),
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("active", true),
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("visibility", "in prep"),
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("visibility", "public"),
    ]);

    setMetricValue("metric-total-courses", totalRes.count);
    setMetricValue("metric-active-courses", activeRes.count);
    setMetricValue("metric-prep-courses", prepRes.count);
    setMetricValue("metric-public-courses", publicRes.count);
  } catch (error) {
    console.error("Error cargando métricas de cursos:", error);
  }
}

/* ---- Métricas Actividad / Progreso ---- */

async function loadProgressMetrics() {
  try {
    const completedRes = await supabase
      .from("progress")
      .select("*", { count: "exact", head: true })
      .eq("completed", true);

    setMetricValue("metric-completed-lessons", completedRes.count);
  } catch (error) {
    console.error("Error cargando métricas de progreso:", error);
  }
}

/* ---- Utilidades ---- */

function setMetricValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value === null || value === undefined) {
    el.textContent = "0";
  } else {
    el.textContent = String(value);
  }
}


/* ---- Cerrar sesión ---- */
document.addEventListener("DOMContentLoaded", () => {
  const dropdown = document.getElementById("admin-user-dropdown");
  const toggleBtn = document.getElementById("admin-user-toggle");
  const logoutBtn = document.getElementById("admin-logout-btn");

  // Abrir/cerrar menú:
  toggleBtn.addEventListener("click", () => {
    dropdown.classList.toggle("admin-user-dropdown--hidden");
  });

  // Cerrar sesión:
  logoutBtn.addEventListener("click", async () => {
    try {
      const { supabase } = window;

      await supabase.auth.signOut();
      window.location.href = "/index.html";
    } catch (err) {
      console.error("Error cerrando sesión:", err);
    }
  });
});

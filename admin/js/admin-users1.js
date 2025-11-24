// ===============================================
//  Inicialización Supabase para Admin > Usuarios
// ===============================================

console.log("¿Supabase existe?", window.supabase);

function getSupabaseClient() {
  if (window.supabase) return window.supabase;
  throw new Error(
    "No se encontró window.supabase. Asegúrate de inicializar Supabase antes de admin-users.js"
  );
}

const supabase = getSupabaseClient();

// Estado
let currentAdminProfile = null;
let allUsers = [];
let filteredUsers = [];
let currentSelectedUser = null;

// Elementos UI
const rolePill = document.getElementById("current-role-pill");
const tableBody = document.getElementById("users-table-body");
const emptyState = document.getElementById("users-empty-state");
const loadingOverlay = document.getElementById("users-loading");

const searchInput = document.getElementById("search-input");
const roleFilter = document.getElementById("role-filter");
const languageFilter = document.getElementById("language-filter");

const cards = {
  total: document.querySelector("#card-total-users [data-value]"),
  admins: document.querySelector("#card-admins [data-value]"),
  coaches: document.querySelector("#card-coaches [data-value]"),
  users: document.querySelector("#card-users [data-value]")
};

// Panel de detalle
const panel = document.getElementById("user-detail-panel");
const closePanelBtn = document.getElementById("close-detail-panel");

// ==========================
//   Inicialización general
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadCurrentAdminProfile();
  if (!currentAdminProfile) return;

  if (!["admin", "coach"].includes(currentAdminProfile.role)) {
    document.getElementById("access-message").classList.remove("access-message--hidden");
    return;
  }

  await loadUsers();
  attachEvents();
});


// ===============================================
//         PERFIL ACTUAL DEL ADMIN
// ===============================================
async function loadCurrentAdminProfile() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    rolePill.textContent = "Sin sesión";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    rolePill.textContent = "Error perfil";
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
    rolePill.textContent = profile.role;
  }
}


// ===============================================
//          CARGAR LISTA DE USUARIOS
// ===============================================
async function loadUsers() {
  showLoading();

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      role,
      country,
      language,
      timezone,
      xp_total,
      streak_current,
      streak_best,
      updated_at,
      avatar_url
    `);

  hideLoading();

  if (error) {
    console.error("Error cargando usuarios:", error);
    return;
  }

  allUsers = data;
  filteredUsers = [...allUsers];

  updateSummaryCards();
  renderTable();
}


// ===============================================
//              CARDS SUPERIORES
// ===============================================
function updateSummaryCards() {
  cards.total.textContent = allUsers.length;
  cards.admins.textContent = allUsers.filter(u => u.role === "admin").length;
  cards.coaches.textContent = allUsers.filter(u => u.role === "coach").length;
  cards.users.textContent = allUsers.filter(u => u.role === "user").length;
}


// ===============================================
//                  FILTROS
// ===============================================
function applyFilters() {
  const search = searchInput.value.toLowerCase().trim();
  const role = roleFilter.value;
  const lang = languageFilter.value;

  filteredUsers = allUsers.filter(u => {
    const matchSearch =
      u.full_name?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search);

    const matchRole = role ? u.role === role : true;
    const matchLang = lang ? u.language === lang : true;

    return matchSearch && matchRole && matchLang;
  });

  renderTable();
}

function attachEvents() {
  searchInput.addEventListener("input", applyFilters);
  roleFilter.addEventListener("change", applyFilters);
  languageFilter.addEventListener("change", applyFilters);

  document.getElementById("refresh-users").addEventListener("click", loadUsers);

  closePanelBtn.addEventListener("click", () => {
    panel.classList.add("detail-panel--hidden");
  });
}


// ===============================================
//                RENDER TABLA
// ===============================================
function renderTable() {
  tableBody.innerHTML = "";

  if (filteredUsers.length === 0) {
    emptyState.classList.remove("empty-state--hidden");
    return;
  }

  emptyState.classList.add("empty-state--hidden");

  filteredUsers.forEach(u => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-avatar">${u.full_name?.charAt(0) ?? "?"}</div>
          <div>
            <div class="user-name">${u.full_name ?? "-"}</div>
            <div class="user-email">${u.email ?? ""}</div>
          </div>
        </div>
      </td>
      <td>${u.email ?? "-"}</td>
      <td><span class="role-badge role-badge--${u.role}">${u.role}</span></td>
      <td>${u.country ?? "-"} / ${u.language ?? "-"}</td>
      <td>${u.timezone ?? "-"}</td>
      <td>${u.xp_total ?? "0"}</td>
      <td>${u.streak_current ?? 0}d</td>
      <td>${formatDate(u.updated_at)}</td>
    `;

    tr.addEventListener("click", () => openUserDetail(u));

    tableBody.appendChild(tr);
  });
}


// ===============================================
//           PANEL DE DETALLE DE USUARIO
// ===============================================
function openUserDetail(user) {
  panel.classList.remove("detail-panel--hidden");

  document.getElementById("detail-name").textContent = user.full_name;
  document.getElementById("detail-email").textContent = user.email;
  document.getElementById("detail-role-badge").textContent = user.role;
  document.getElementById("detail-created").textContent = "Actualizado: " + formatDate(user.updated_at);

  // Datos del formulario:
  document.getElementById("field-full_name").value = user.full_name ?? "";
  document.getElementById("field-avatar_url").value = user.avatar_url ?? "";
  document.getElementById("field-country").value = user.country ?? "";
  document.getElementById("field-language").value = user.language ?? "es";
  document.getElementById("field-timezone").value = user.timezone ?? "";
  document.getElementById("field-preferred_focus_time").value = user.preferred_focus_time ?? "";
  document.getElementById("field-goals_json").value = user.goals_json ?? "";
  document.getElementById("field-notifications").value = user.notifications ?? "";

  // Estadísticas:
  document.getElementById("stat-level").textContent = user.level ?? "-";
  document.getElementById("stat-xp-total").textContent = user.xp_total ?? "-";
  document.getElementById("stat-streak-current").textContent = user.streak_current ?? "-";
  document.getElementById("stat-streak-best").textContent = user.streak_best ?? "-";

}


// ===============================================
//              UTILIDADES
// ===============================================
function showLoading() {
  loadingOverlay.classList.remove("loading-overlay--hidden");
}
function hideLoading() {
  loadingOverlay.classList.add("loading-overlay--hidden");
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("es-ES");
}



/* ============================================================
   GUARDAR CAMBIOS EN PERFIL
============================================================ */

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const saveStatus = document.getElementById("profile-save-status");
  saveStatus.textContent = "Guardando...";

  const fields = {
    full_name: document.getElementById("field-full_name").value.trim(),
    avatar_url: document.getElementById("field-avatar_url").value.trim(),
    country: document.getElementById("field-country").value.trim(),
    language: document.getElementById("field-language").value,
    timezone: document.getElementById("field-timezone").value.trim(),
    preferred_focus_time: document.getElementById("field-preferred_focus_time").value.trim(),
    goals_json: document.getElementById("field-goals_json").value.trim(),
    notifications: document.getElementById("field-notifications").value.trim(),
  };

  const { error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", currentSelectedUser.id);

  if (error) {
    console.error("Error guardando cambios:", error);
    saveStatus.textContent = "❌ Error guardando cambios";
    return;
  }

  saveStatus.textContent = "✔ Guardado";
  setTimeout(() => (saveStatus.textContent = ""), 2000);

  // refrescar tabla
  loadUsers();
});

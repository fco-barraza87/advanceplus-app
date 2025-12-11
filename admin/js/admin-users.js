import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

const tbody = document.getElementById("usersTableBody");

let allUsers = [];

// ================================
// Cargar usuarios
// ================================
async function loadUsers() {
  await requireAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      avatar_url,
      role,
      onboarding_completed,
      created_at,
      user_stats:user_stats (
        xp_total,
        streak_current,
        level,
        streak_best
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando usuarios:", error);
    return;
  }

  allUsers = data;
  renderUsers(allUsers);
}


// ================================
// Render tabla
// ================================
// ================================
// Cargar usuarios
// ================================
async function loadUsers() {
  await requireAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      avatar_url,
      role,
      onboarding_completed,
      created_at,
      user_stats:user_stats (
        xp_total,
        streak_current,
        level,
        streak_best
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando usuarios:", error);
    return;
  }

  allUsers = data;
  renderUsers(allUsers);
}

// ================================
// Render tabla
// ================================
function renderUsers(list) {
  tbody.innerHTML = "";

  list.forEach(u => {
    const stats = u.user_stats ?? {}; // seguridad

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <img src="${u.avatar_url ?? "/images/default-avatar.png"}" class="user-avatar">
          <div>
            <strong>${u.full_name ?? "(Sin nombre)"}</strong><br>
            <span style="opacity:0.7">${u.email}</span>
          </div>
        </div>
      </td>

      <td>
        <span class="role-chip role-${u.role}">${u.role}</span>
      </td>

      <td>
        ${stats.xp_total ?? 0} XP<br>
        <span style="opacity:0.7">${stats.streak_current ?? 0} días</span>
      </td>

      <td>${u.onboarding_completed ? "✔" : "❌"}</td>

      <td>${u.created_at?.split("T")[0] ?? ""}</td>

      <td>
        <button class="btn-small" onclick="viewUser('${u.id}')">Ver</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}


// ================================
// Navegar al detalle
// ================================
window.viewUser = (id) => {
  window.location.href = `/admin/user-details.html?id=${id}`;
};

// ================================
// Filtros
// ================================
document.getElementById("searchInput").addEventListener("input", applyFilters);
document.getElementById("roleFilter").addEventListener("change", applyFilters);
document.getElementById("onboardingFilter").addEventListener("change", applyFilters);
document.getElementById("activityFilter").addEventListener("change", applyFilters);

function applyFilters() {
  let filtered = [...allUsers];

  const search = document.getElementById("searchInput").value.toLowerCase();
  const role = document.getElementById("roleFilter").value;
  const onboarding = document.getElementById("onboardingFilter").value;
  const activity = document.getElementById("activityFilter").value;

  if (search) {
    filtered = filtered.filter(u =>
      (u.full_name || "").toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    );
  }

  if (role) filtered = filtered.filter(u => u.role === role);
  if (onboarding === "1") filtered = filtered.filter(u => u.onboarding_completed);
  if (onboarding === "0") filtered = filtered.filter(u => !u.onboarding_completed);

  if (activity === "xp") filtered.sort((a, b) => (b.user_stats?.xp_total ?? 0) - (a.user_stats?.xp_total ?? 0));
  if (activity === "streak") filtered.sort((a, b) => b.streak_current - a.streak_current);
  if (activity === "recent") filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  renderUsers(filtered);
}

// INICIO
loadUsers();

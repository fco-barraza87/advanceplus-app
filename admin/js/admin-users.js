import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

const tableBody = document.getElementById("usersTableBody");

// ============================
// 1. Cargar Usuarios
// ============================
async function loadUsers() {
  await requireAdmin();

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, onboarding_completed, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando usuarios:", error);
    return;
  }

  renderUsers(users);
  window._allUsers = users;
}

// ============================
// 2. Render Tabla
// ============================
function renderUsers(list) {
  tableBody.innerHTML = "";

  list.forEach(user => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.full_name ?? "(sin nombre)"}</td>
      <td>${user.email}</td>
      <td><span class="role-chip role-${user.role}">${user.role}</span></td>
      <td>${user.onboarding_completed ? "✔" : "❌"}</td>
      <td>${user.created_at?.split("T")[0]}</td>
      <td>
        <button class="btn-small" onclick="viewUser('${user.id}')">Ver</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

// ============================
// 3. Ver usuario (Módulo 2B)
// ============================
window.viewUser = (id) => {
  window.location.href = `/admin/user-details.html?id=${id}`;
};

// ============================
// 4. Filtros
// ============================
document.getElementById("searchInput").addEventListener("input", applyFilters);
document.getElementById("roleFilter").addEventListener("change", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);

function applyFilters() {
  let users = window._allUsers;

  const search = document.getElementById("searchInput").value.toLowerCase();
  const role = document.getElementById("roleFilter").value;
  const status = document.getElementById("statusFilter").value;

  let filtered = users.filter(u =>
    (u.full_name?.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
  );

  if (role) filtered = filtered.filter(u => u.role === role);

  if (status === "completed") filtered = filtered.filter(u => u.onboarding_completed);
  if (status === "pending") filtered = filtered.filter(u => !u.onboarding_completed);

  renderUsers(filtered);
}

// INICIO
loadUsers();

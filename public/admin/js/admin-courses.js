import { supabase } from "/js/supabase.js";
import { requireAdmin } from "/admin/js/admin-auth.js";

let allCourses = [];
const tbody = document.getElementById("coursesTableBody");

// =========================================================
// INIT
// =========================================================
async function init() {
  await requireAdmin();

  setupSidebarToggle();
  setupActions();

  await loadCourses();
  applyFilters(); // inicial
}

document.addEventListener("DOMContentLoaded", init);

// =========================================================
// TOGGLE SIDEBAR
// =========================================================
function setupSidebarToggle() {
  const btn = document.getElementById("sidebarToggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    document.querySelector(".admin-sidebar")?.classList.toggle("sidebar-closed");
    document.querySelector(".admin-header-bar")?.classList.toggle("header-shifted");
  });
}

// =========================================================
// LOAD COURSES
// =========================================================
async function loadCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando cursos:", error);
    return;
  }

  allCourses = data;
  renderCourses(allCourses);
}

// =========================================================
// RENDER TABLE
// =========================================================
function renderCourses(list) {
  tbody.innerHTML = "";

  list.forEach(c => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <span class="course-title">${c.title ?? "(Sin título)"}</span>
      </td>

      <td>${c.slug ?? ""}</td>

      <td>
        <span class="badge badge-${visibilityClass(c.visibility)}">
          ${c.visibility}
        </span>
      </td>

      <td>
        <span class="badge badge-${c.active ? "active" : "inactive"}">
          ${c.active ? "Activo" : "Inactivo"}
        </span>
      </td>

      <td>${c.created_at?.split("T")[0] ?? "—"}</td>

      <td>
        <button class="btn-small" onclick="editCourse('${c.id}')">Editar</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

window.editCourse = (id) => {
  window.location.href = `/admin/course-details.html?id=${id}`;
};

function visibilityClass(v) {
  if (v === "public") return "public";
  if (v === "private") return "private";
  return "inprep"; // in prep
}

// =========================================================
// FILTERS
// =========================================================
function setupActions() {
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("filterVisibility").addEventListener("change", applyFilters);
  document.getElementById("filterActive").addEventListener("change", applyFilters);
  document.getElementById("filterSort").addEventListener("change", applyFilters);

  document.getElementById("btnNewCourse").addEventListener("click", () => {
    window.location.href = "/admin/course-details.html";
  });
}

function applyFilters() {
  let filtered = [...allCourses];

  const search = document.getElementById("searchInput").value.toLowerCase();
  const visibility = document.getElementById("filterVisibility").value;
  const active = document.getElementById("filterActive").value;
  const sort = document.getElementById("filterSort").value;

  // TEXT FILTER
  if (search) {
    filtered = filtered.filter(c =>
      (c.title ?? "").toLowerCase().includes(search) ||
      (c.slug ?? "").toLowerCase().includes(search) ||
      (c.category ?? "").toLowerCase().includes(search)
    );
  }

  // VISIBILITY
  if (visibility) filtered = filtered.filter(c => c.visibility === visibility);

  // ACTIVE
  if (active === "1") filtered = filtered.filter(c => c.active);
  if (active === "0") filtered = filtered.filter(c => !c.active);

  // SORT
  if (sort === "alpha") filtered.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "oldest") filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (sort === "newest") filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  renderCourses(filtered);
}

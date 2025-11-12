// users.js
const SUPABASE_URL = "https://TU_URL_SUPABASE.supabase.co";
const SUPABASE_KEY = "TU_API_KEY_PUBLICA";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const table = document.getElementById("users-table");
const detail = document.getElementById("user-detail");
const search = document.getElementById("search");
const backBtn = document.getElementById("back");

const assignSelect = document.getElementById("assign-course");
const assignBtn = document.getElementById("assign-btn");
const bonusBtn = document.getElementById("bonus-btn");
const bonusInput = document.getElementById("bonus-xp");
const roleSelect = document.getElementById("user-role-detail");
const saveRoleBtn = document.getElementById("save-role");

let selectedUser = null;

// 🔙 Volver
backBtn.addEventListener("click", () => (window.location.href = "index.html"));

// 🔍 Buscar
search.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const rows = table.querySelectorAll("tr");
  rows.forEach((row) => {
    const name = row.querySelector("td")?.textContent.toLowerCase();
    row.style.display = name.includes(query) ? "" : "none";
  });
});

init();

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("No hay sesión activa.");
    window.location.href = "../index.html";
    return;
  }
  loadUsers();
  loadCoursesList();
}

// 🧩 Cargar usuarios
async function loadUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, role");

  if (error) return console.error(error);

  table.innerHTML = "";
  for (const u of data) {
    const xp = await getUserXp(u.id);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${u.full_name || "Sin nombre"}</td>
      <td>${u.email}</td>
      <td>${u.role || "user"}</td>
      <td>${xp}</td>
      <td><button class="btn-small" onclick="viewUser('${u.id}')">👁️ Ver</button></td>
    `;
    table.appendChild(row);
  }
}

// 🔢 Obtener XP total
async function getUserXp(userId) {
  const { data, error } = await supabase
    .from("progress")
    .select("xp")
    .eq("user_id", userId);
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + (r.xp || 0), 0);
}

// 👁️ Ver detalle usuario
async function viewUser(id) {
  selectedUser = id;

  const { data: u } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  const { data: progress } = await supabase
    .from("progress")
    .select("xp, streak")
    .eq("user_id", id);

  const totalXp = progress?.reduce((s, p) => s + (p.xp || 0), 0) || 0;
  const avgStreak =
    progress?.length > 0
      ? Math.round(progress.reduce((s, p) => s + (p.streak || 0), 0) / progress.length)
      : 0;

  document.getElementById("user-name-detail").textContent = u.full_name || "Usuario";
  document.getElementById("user-email-detail").textContent = u.email;
  document.getElementById("user-xp-detail").textContent = totalXp;
  document.getElementById("user-streak-detail").textContent = avgStreak;
  roleSelect.value = u.role || "user";

  detail.style.display = "block";
  loadUserCourses(id);
}

// 📘 Cargar cursos de usuario
async function loadUserCourses(userId) {
  const list = document.getElementById("user-courses-list");
  list.innerHTML = "";

  const { data, error } = await supabase
    .from("user_courses")
    .select("course_id, status, courses(title)")
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    list.innerHTML = "<li>Error cargando cursos.</li>";
    return;
  }

  if (data.length === 0) {
    list.innerHTML = "<li>Sin cursos asignados</li>";
    return;
  }

  data.forEach((c) => {
    const li = document.createElement("li");
    li.textContent = `${c.courses?.title || "Sin título"} — ${c.status}`;
    list.appendChild(li);
  });
}

// 📚 Lista de cursos activos
async function loadCoursesList() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .eq("active", true);

  if (error) return console.error(error);
  assignSelect.innerHTML = "";
  data.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    assignSelect.appendChild(opt);
  });
}

// 🎯 Asignar curso
assignBtn.addEventListener("click", async () => {
  if (!selectedUser) return alert("Selecciona un usuario primero.");

  const courseId = assignSelect.value;
  const { error } = await supabase.from("user_courses").insert([
    { user_id: selectedUser, course_id: courseId, status: "active" },
  ]);

  if (error) alert("❌ Error: " + error.message);
  else {
    alert("✅ Curso asignado correctamente.");
    loadUserCourses(selectedUser);
  }
});

// ➕ Bonificar XP manualmente
bonusBtn.addEventListener("click", async () => {
  const xpValue = parseInt(bonusInput.value);
  if (!xpValue || xpValue <= 0) return alert("Introduce una cantidad válida de XP.");

  const { error } = await supabase.from("progress").insert([
    { user_id: selectedUser, course_id: null, xp: xpValue, completed: true, day: 0 },
  ]);

  if (error) alert("Error al asignar XP: " + error.message);
  else {
    alert(`✅ ${xpValue} XP añadidos al usuario.`);
    viewUser(selectedUser); // refresca
    bonusInput.value = "";
  }
});

// 🔄 Cambiar rol
saveRoleBtn.addEventListener("click", async () => {
  const newRole = roleSelect.value;

  const { error } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", selectedUser);

  if (error) alert("Error al cambiar rol: " + error.message);
  else alert("✅ Rol actualizado correctamente.");
});

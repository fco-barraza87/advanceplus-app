// courses.js
const SUPABASE_URL = "https://TU_URL_SUPABASE.supabase.co";
const SUPABASE_KEY = "TU_API_KEY_PUBLICA";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const form = document.getElementById("new-course-form");
const table = document.getElementById("courses-table");
const backBtn = document.getElementById("back");

// Volver al panel principal
backBtn.addEventListener("click", () => (window.location.href = "index.html"));

init();

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("No hay sesión activa. Inicia sesión.");
    window.location.href = "../index.html";
    return;
  }
  loadCourses();
}

// 📦 Subir imagen a Storage
async function uploadCover(file) {
  if (!file) return null;
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from("covers")
    .upload(fileName, file);

  if (error) {
    console.error("Error subiendo imagen:", error.message);
    return null;
  }

  const { data: publicUrl } = supabase.storage
    .from("covers")
    .getPublicUrl(fileName);

  return publicUrl.publicUrl;
}

// 🧩 Crear nuevo curso
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const coverFile = document.getElementById("cover").files[0];
  const active = document.getElementById("status").value === "true";

  const cover_url = await uploadCover(coverFile);

  const { error } = await supabase.from("courses").insert([
    {
      title,
      description,
      cover_url,
      active,
    },
  ]);

  if (error) {
    alert("❌ Error creando curso: " + error.message);
  } else {
    alert("✅ Curso creado con éxito");
    form.reset();
    loadCourses();
  }
});

// 🧾 Cargar cursos
async function loadCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  table.innerHTML = "";
  data.forEach((c) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${c.title}</td>
      <td>${c.active ? "🟢 Activo" : "⚫ Inactivo"}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
      <td>
        <button onclick="toggleCourse('${c.id}', ${c.active})" class="btn-small">🔁</button>
        <button onclick="deleteCourse('${c.id}')" class="btn-small red">🗑️</button>
      </td>
    `;
    table.appendChild(row);
  });
}

// 🔄 Cambiar estado
async function toggleCourse(id, current) {
  const { error } = await supabase
    .from("courses")
    .update({ active: !current })
    .eq("id", id);
  if (error) {
    alert("Error al cambiar estado");
  } else {
    loadCourses();
  }
}

// 🗑️ Eliminar curso
async function deleteCourse(id) {
  if (!confirm("¿Eliminar este curso definitivamente?")) return;
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) {
    alert("Error eliminando curso: " + error.message);
  } else {
    loadCourses();
  }
}

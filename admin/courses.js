// /admin/courses.js
import { supabase } from "/js/supabase.js";
import { requireAdmin, setAdminHeader } from "/admin/js/admin.js";

let currentCourses = [];

document.addEventListener("DOMContentLoaded", async () => {
  await requireAdmin();
  setAdminHeader("Panel Admin · Cursos", "Ver, crear y editar cursos.");

  setupEvents();
  await loadCourses();
});

function setupEvents() {
  const btnNew = document.getElementById("btnNewCourse");
  const form = document.getElementById("courseForm");
  const btnReset = document.getElementById("btnResetCourseForm");

  btnNew.addEventListener("click", () => {
    clearCourseForm();
    document.getElementById("courseFormTitle").textContent = "Nuevo curso";
  });

  btnReset.addEventListener("click", () => {
    clearCourseForm();
    document.getElementById("courseFormTitle").textContent = "Nuevo curso";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveCourse();
  });
}

async function loadCourses() {
  const tbody = document.getElementById("coursesTableBody");
  tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando cursos:", error);
    tbody.innerHTML = `<tr><td colspan="5">Error al cargar cursos</td></tr>`;
    return;
  }

  currentCourses = data || [];
  renderCoursesTable();
}

function renderCoursesTable() {
  const tbody = document.getElementById("coursesTableBody");
  if (!currentCourses.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay cursos.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  currentCourses.forEach((course) => {
    const tr = document.createElement("tr");
    tr.classList.add("admin-row-click");
    tr.innerHTML = `
      <td>${course.title}</td>
      <td>${course.slug}</td>
      <td>${course.category}</td>
      <td>${course.duration_days}</td>
      <td>${course.active ? "Sí" : "No"}</td>
    `;
    tr.addEventListener("click", () => fillCourseForm(course));
    tbody.appendChild(tr);
  });
}

function fillCourseForm(course) {
  document.getElementById("courseFormTitle").textContent = "Editar curso";
  document.getElementById("courseId").value = course.id;
  document.getElementById("courseTitle").value = course.title ?? "";
  document.getElementById("courseSlug").value = course.slug ?? "";
  document.getElementById("courseSubtitle").value = course.subtitle ?? "";
  document.getElementById("courseDescription").value = course.description ?? "";
  document.getElementById("courseCategory").value = course.category ?? "";
  document.getElementById("courseDurationDays").value = course.duration_days ?? 0;
  document.getElementById("courseLevel").value = course.level ?? "";
  document.getElementById("courseCoverUrl").value = course.cover_url ?? "";
  document.getElementById("coursePrice").value = course.price ?? "";
  document.getElementById("courseCurrency").value = course.currency ?? "CHF";
  document.getElementById("courseXpReward").value = course.xp_reward ?? 0;
  document.getElementById("courseProgressionType").value = course.progression_type ?? "daily";
  document.getElementById("courseTags").value = (course.tags || []).join(", ");
  document.getElementById("courseActive").checked = course.active ?? true;
  document.getElementById("courseVisibility").value = course.visibility ?? "public";
}

function clearCourseForm() {
  document.getElementById("courseId").value = "";
  document.getElementById("courseTitle").value = "";
  document.getElementById("courseSlug").value = "";
  document.getElementById("courseSubtitle").value = "";
  document.getElementById("courseDescription").value = "";
  document.getElementById("courseCategory").value = "";
  document.getElementById("courseDurationDays").value = 7;
  document.getElementById("courseLevel").value = "Inicial";
  document.getElementById("courseCoverUrl").value = "";
  document.getElementById("coursePrice").value = "";
  document.getElementById("courseCurrency").value = "CHF";
  document.getElementById("courseXpReward").value = 0;
  document.getElementById("courseProgressionType").value = "daily";
  document.getElementById("courseTags").value = "";
  document.getElementById("courseActive").checked = true;
  document.getElementById("courseVisibility").value = "public";
}

async function saveCourse() {
  const id = document.getElementById("courseId").value || null;

  const tagsRaw = document
    .getElementById("courseTags")
    .value.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const payload = {
    title: document.getElementById("courseTitle").value.trim(),
    slug: document.getElementById("courseSlug").value.trim(),
    subtitle: document.getElementById("courseSubtitle").value.trim() || null,
    description: document.getElementById("courseDescription").value.trim(),
    category: document.getElementById("courseCategory").value.trim(),
    duration_days: parseInt(document.getElementById("courseDurationDays").value, 10) || 0,
    level: document.getElementById("courseLevel").value.trim(),
    cover_url: document.getElementById("courseCoverUrl").value.trim(),
    price: document.getElementById("coursePrice").value || null,
    currency: document.getElementById("courseCurrency").value.trim() || "CHF",
    xp_reward: parseInt(document.getElementById("courseXpReward").value, 10) || 0,
    progression_type: document.getElementById("courseProgressionType").value.trim() || "daily",
    tags: tagsRaw.length ? tagsRaw : null,
    active: document.getElementById("courseActive").checked,
    visibility: document.getElementById("courseVisibility").value,
  };

  let error;
  if (id) {
    const { error: err } = await supabase.from("courses").update(payload).eq("id", id);
    error = err;
  } else {
    const { error: err } = await supabase.from("courses").insert([payload]);
    error = err;
  }

  if (error) {
    console.error("Error guardando curso:", error);
    alert("Error al guardar el curso. Revisa la consola.");
    return;
  }

  alert("Curso guardado correctamente.");
  clearCourseForm();
  await loadCourses();
}

import { supabase } from "/js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Obtener usuario
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;
  const user = session.user;

  // Cargar retos
  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error cargando retos:", error);
    return;
  }

  // Separar activos vs todos
  const active = courses.filter(c => c.progress && c.progress < 100);
  const available = courses;

  renderCourseList("activeCoursesGrid", "noActiveCourses", active, true);
  renderCourseList("allCoursesGrid", "noCoursesMessage", available, false);
});

/**
 * RENDERIZADOR UNIVERSAL DE CURSOS (USA TU DISEÑO)
 */
function renderCourseList(gridId, emptyId, list, showProgress) {
  const container = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);

  if (!list || list.length === 0) {
    empty.style.display = "block";
    return;
  }

  list.forEach(course => {
    const progress = course.progress ?? 0;

    const div = document.createElement("div");
    div.classList.add("course-card");
    div.onclick = () => {
      location.href = `/curso-info/index.html?id=${course.id}`;
    };

    div.innerHTML = `
      <div class="course-cover-wrapper">
        <img src="${course.cover_url}" class="course-cover" />
        <span class="course-badge">${course.category}</span>
      </div>

      <div class="course-body">
        <h3 class="course-title">${course.title}</h3>
        <p class="course-meta">${course.short_description ?? ""}</p>

        ${showProgress ? `
          <div class="course-progress-bar">
            <div class="course-progress-fill" style="width:${progress}%"></div>
          </div>
        ` : ""}

        <div class="course-actions">
          <button class="btn-course">
            ${progress === 0 ? "Comenzar" :
              progress >= 100 ? "Revisar" : "Continuar"}
          </button>
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();

  // 1) Obtener usuario
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;
  const user = session.user;

  // 2) Traer todos los retos disponibles
  const { data: allCourses } = await supabase
    .from("courses")
    .select("*")
    .order("order_index", { ascending: true });

  // 3) Traer progresos del usuario
  const { data: userCourses } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", user.id);

  // --- HTML containers ---
  const activeContainer = document.getElementById("activeCoursesGrid");
  const exploreContainer = document.getElementById("exploreCoursesGrid");

  const activeEmpty = document.getElementById("noActiveMessage");
  const exploreEmpty = document.getElementById("noExploreMessage");

  const activeCount = document.getElementById("activeCount");

  // 4) Clasificar retos
  const activos = [];
  const explorar = [];

  allCourses.forEach(course => {
    const match = userCourses?.find(uc => uc.course_id === course.id);

    if (match && match.status === "active") {
      activos.push(course);
    } else {
      explorar.push(course);
    }
  });

  // ---- RENDER UI ----

  // ⭐ Contador activos
  activeCount.textContent = activos.length;

  // ⭐ Activos
  if (activos.length === 0) {
    activeEmpty.style.display = "block";
  } else {
    activos.forEach(c => activeContainer.appendChild(renderCourseCard(c, true)));
  }

  // ⭐ Explorar
  if (explorar.length === 0) {
    exploreEmpty.style.display = "block";
  } else {
    explorar.forEach(c => exploreContainer.appendChild(renderCourseCard(c, false)));
  }
});


// --------------------------------------------------------------
// 🧩 Componente: Tarjeta de curso (reutiliza estilos existentes)
// --------------------------------------------------------------
function renderCourseCard(course, isActive) {

  const div = document.createElement("div");
  div.classList.add("course-card");

  div.innerHTML = `
    <div class="course-cover-wrapper">
        <img class="course-cover" src="${course.cover_url}" alt="${course.title}">
        <span class="course-badge">${course.category}</span>
    </div>

    <div class="course-body">
        <h3 class="course-title">${course.title}</h3>
        <p class="course-meta">${course.level}</p>
        
        <div class="course-actions">
            ${
              isActive
                ? `<button class="btn-continue" onclick="location.href='/curso/index.html?id=${course.id}'">Continuar</button>`
                : `<button class="btn-course" onclick="location.href='/curso-info/index.html?id=${course.id}'">Comenzar</button>`
            }
        </div>
    </div>
  `;

  return div;
}

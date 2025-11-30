import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();

  const { data: courses } = await supabase.from("courses").select("*");

  const container = document.getElementById("allCoursesGrid");
  const empty = document.getElementById("noCoursesMessage");

  if (!courses || courses.length === 0) {
    empty.style.display = "block";
    return;
  }

  courses.forEach(c => {
    const div = document.createElement("div");
    div.classList.add("course-card");
    div.innerHTML = `
      <h3>${c.title}</h3>
      <p>${c.category}</p>
      <button onclick="location.href='/curso-info/index.html?id=${c.id}'">
        Ver más
      </button>
    `;
    container.appendChild(div);
  });
});

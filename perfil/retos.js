function renderCourses(containerId, emptyMsgId, list, showProgress) {
  const container = document.getElementById(containerId);
  const empty = document.getElementById(emptyMsgId);

  if (!list || list.length === 0) {
    empty.style.display = "block";
    return;
  }

  list.forEach(course => {
    const div = document.createElement("div");
    div.classList.add("course-card");

    const progress = course.progress ?? 0;

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
          <button class="btn-course"
            onclick="location.href='/curso-info/index.html?id=${course.id}'">
            ${progress === 0 ? "Comenzar" : progress >= 100 ? "Revisar" : "Continuar"}
          </button>
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

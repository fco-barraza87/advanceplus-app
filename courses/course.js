const SUPABASE_URL = "https://TU_URL_SUPABASE.supabase.co";
const SUPABASE_KEY = "TU_API_KEY_PUBLICA";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get("course");
const day = parseInt(urlParams.get("day") || 1);

const titleEl = document.getElementById("lesson-title");
const contentEl = document.getElementById("lesson-content");
const completeBtn = document.getElementById("complete-btn");

init();

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("Inicia sesión para acceder al curso.");
    window.location.href = "../index.html";
    return;
  }

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("title, content_html, audio_url")
    .eq("course_id", courseId)
    .eq("day", day)
    .single();

  if (error || !lesson) {
    contentEl.innerHTML = "<p>Error cargando la lección.</p>";
    return;
  }

  titleEl.textContent = lesson.title;
  document.getElementById("page-title").textContent = lesson.title;
  contentEl.innerHTML = lesson.content_html;

  if (lesson.audio_url) {
    const audio = document.createElement("audio");
    audio.src = lesson.audio_url;
    audio.controls = true;
    contentEl.prepend(audio);
  }

  completeBtn.addEventListener("click", () => markComplete(user.id));
}

async function markComplete(userId) {
  const { error } = await supabase.from("progress").insert([
    {
      user_id: userId,
      course_id: courseId,
      day,
      completed: true,
      xp: 25,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    alert("Error al guardar progreso: " + error.message);
  } else {
    alert("✅ Día completado. +25 XP ganados.");
    // Redirigir al siguiente día
    window.location.href = `course.html?course=${courseId}&day=${day + 1}`;
  }
}

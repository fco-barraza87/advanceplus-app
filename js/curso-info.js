import { supabase } from "/js/supabase.js";

function qs(sel) {
  return document.querySelector(sel);
}

async function loadCourse() {
  const url = new URL(window.location.href);
  const courseId = url.searchParams.get("c");
  if (!courseId) return;

  // 1. Traer curso
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) {
    alert("Curso no encontrado");
    return;
  }

  // 2. Hero
  qs("#courseHero").style.backgroundImage = `url(${course.cover_url})`;

  qs("#courseTitle").textContent = course.title;
  qs("#courseSubtitle").textContent = course.subtitle || "";
  qs("#courseCategory").textContent = course.category;

  qs("#courseDescription").textContent = course.description;
  qs("#courseDays").textContent = `${course.duration_days} días`;
  qs("#courseLevel").textContent = course.level;
  qs("#courseXP").textContent = `${course.xp_reward || 0} XP`;

  // 3. Traer lecciones
  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("day", { ascending: true });

  const list = qs("#courseModulesList");

  (lessons || []).forEach((l) => {
    const div = document.createElement("div");
    div.className = "module-item";
    div.textContent = `Día ${l.day}: ${l.title}`;
    list.appendChild(div);
  });

  // 4. ¿El usuario tiene este curso?
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userHasCourse = false;

  const { data: uc } = await supabase
    .from("user_courses")
    .select("*")
    .eq("user_id", user.id)
    .eq("course_id", courseId);

  userHasCourse = uc && uc.length > 0;

  const actions = qs("#courseActionContainer");
  actions.innerHTML = "";

  // 5. Renderizar botón inteligente
  const btn = document.createElement("button");
  btn.className = "btn-course";

  if (userHasCourse) {
    btn.textContent = "Continuar curso";
    btn.onclick = () =>
      (window.location.href = `/curso/index.html?c=${courseId}&day=1`);
  } else if (course.price && course.price > 0) {
    btn.textContent = `Comprar — ${course.price} ${course.currency}`;
    btn.onclick = () => alert("Integrar Stripe aquí 💳");
  } else {
    btn.textContent = "Únete a la lista de espera";
    btn.onclick = () => alert("Integrar lista de espera aquí 📬");
  }

  actions.appendChild(btn);
}

loadCourse();

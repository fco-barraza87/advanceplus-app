// /js/onboarding.js
import { supabase } from "/js/supabase.js";

/* -----------------------------------------------------
   Helpers
----------------------------------------------------- */
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/* -----------------------------------------------------
   Navegación entre pasos
----------------------------------------------------- */
export function nextStep(step) {
  window.location.href = `/onboarding/step${step}.html`;
}

// Exponer al scope global para onclick=""
window.nextStep = nextStep;

/* -----------------------------------------------------
   Guardar objetivo principal
   - Se guarda en users.goals_json
----------------------------------------------------- */
export async function saveGoal(goalKey) {
  const user = await getCurrentUser();
  if (!user) return;

  const goals = { main_goal: goalKey };

  await supabase
    .from("users")
    .update({ goals_json: goals })
    .eq("id", user.id);

  nextStep(3);
}

window.saveGoal = saveGoal;

/* -----------------------------------------------------
   Guardar tiempo diario
   - Se guarda en users.preferred_focus_time
----------------------------------------------------- */
export async function saveTime(minutes) {
  const user = await getCurrentUser();
  if (!user) return;

  const focus = `${minutes}_min`; // ej: "10_min"

  await supabase
    .from("users")
    .update({ preferred_focus_time: focus })
    .eq("id", user.id);

  nextStep(4);
}

window.saveTime = saveTime;

/* -----------------------------------------------------
   Auto-avance en step4 (simulación de “creando plan”)
----------------------------------------------------- */
if (window.location.pathname.includes("step4.html")) {
  setTimeout(() => {
    window.location.href = "/onboarding/finish.html";
  }, 2000);
}

/* -----------------------------------------------------
   Finalizar onboarding:
   - marca onboarding_completed = true
   - asigna curso de bienvenida
   - redirige a primera lección del curso
----------------------------------------------------- */
export async function goToFirstLesson() {
  const user = await getCurrentUser();
  if (!user) return;

  // 1) Marcar onboarding como completado
  await supabase
    .from("users")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  // 2) Buscar curso de bienvenida por slug
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, slug")
    .eq("slug", "curso-bienvenida")   // Asegúrate de crear este curso en Supabase
    .single();

  if (courseError || !course) {
    console.error("No se encontró curso-bienvenida, enviando al dashboard.");
    window.location.href = "/dashboard/index.html";
    return;
  }

  // 3) Asignar curso al usuario (si no lo tiene ya)
  await supabase
    .from("user_courses")
    .insert({
      user_id: user.id,
      course_id: course.id,
      status: "active"
    })
    .catch((err) => console.warn("Posible curso duplicado:", err));

  // 4) Enviar al curso
  window.location.href = `/curso/index.html?c=${course.slug}`;
}

window.goToFirstLesson = goToFirstLesson;

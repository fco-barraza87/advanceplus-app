// /js/onboarding.js
import { supabase } from "/js/supabase.js";

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function goTo(url) {
  window.location.href = url;
}

document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;

  // STEP 1: botón "Comenzar"
  if (path.endsWith("step1.html")) {
    const btn = document.getElementById("btnStartOnboarding");
    if (btn) {
      btn.addEventListener("click", () => {
        goTo("/onboarding/step2.html");
      });
    }
    return;
  }

  // STEP 2: elegir objetivo
  if (path.endsWith("step2.html")) {
    const goalButtons = document.querySelectorAll(".goal-btn");
    goalButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const goalKey = btn.dataset.goal;
        const user = await getCurrentUser();
        if (!user) return;

        await supabase
          .from("users")
          .update({ goals_json: { main_goal: goalKey } })
          .eq("id", user.id);

        goTo("/onboarding/step3.html");
      });
    });
    return;
  }

  // STEP 3: elegir tiempo
  if (path.endsWith("step3.html")) {
    const timeButtons = document.querySelectorAll(".time-btn");
    timeButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const minutes = btn.dataset.minutes;
        const user = await getCurrentUser();
        if (!user) return;

        await supabase
          .from("users")
          .update({ preferred_focus_time: `${minutes}_min` })
          .eq("id", user.id);

        goTo("/onboarding/step4.html");
      });
    });
    return;
  }

  // STEP 4: auto-pasar a finish
  if (path.endsWith("step4.html")) {
    setTimeout(() => {
      goTo("/onboarding/finish.html");
    }, 2000);
    return;
  }

  // FINISH: botón ir a primera lección
  if (path.endsWith("finish.html")) {
    const btn = document.getElementById("btnFirstLesson");
    if (btn) {
      btn.addEventListener("click", async () => {
        const user = await getCurrentUser();
        if (!user) return;

        // Marcar onboarding completo
        await supabase
          .from("users")
          .update({ onboarding_completed: true })
          .eq("id", user.id);

        // Buscar curso-bienvenida
        const { data: course, error: courseError } = await supabase
          .from("courses")
          .select("id, slug")
          .eq("slug", "curso-bienvenida")
          .single();

        if (courseError || !course) {
          console.error("No existe curso-bienvenida, envío al dashboard.");
          return goTo("/dashboard/index.html");
        }

        // Asignar curso (si no lo tenía)
        await supabase
          .from("user_courses")
          .insert({
            user_id: user.id,
            course_id: course.id,
            status: "active"
          })
          .catch((err) => console.warn("user_courses duplicado (ok):", err));

        goTo(`/curso/index.html?c=${course.slug}`);
      });
    }
    return;
  }
});

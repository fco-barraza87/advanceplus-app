import { supabase } from "/js/supabase.js";

function goTo(url) {
  window.location.href = url;
}

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;

  /* ---------------------------------------------------
     STEP 1 → Botón “Comenzar”
  --------------------------------------------------- */
  if (path.endsWith("step1.html")) {
    const btn = document.getElementById("btnStartOnboarding");
    if (btn) {
      btn.addEventListener("click", () => {
        goTo("/onboarding/step2.html");
      });
    }
    return;
  }

  /* ---------------------------------------------------
     STEP 2 → Guardar objetivo
  --------------------------------------------------- */
  if (path.endsWith("step2.html")) {
    const options = document.querySelectorAll(".goal-btn");

    options.forEach(btn => {
      btn.addEventListener("click", async () => {
        const goal = btn.dataset.goal;
        const user = await getUser();
        if (!user) return;

        await supabase
          .from("profiles")  // ← CAMBIO AQUÍ
          .update({ goals_json: { main_goal: goal } })
          .eq("id", user.id);

        goTo("/onboarding/step3.html");
      });
    });

    return;
  }

  /* ---------------------------------------------------
     STEP 3 → Guardar tiempo
  --------------------------------------------------- */
  if (path.endsWith("step3.html")) {
    const btns = document.querySelectorAll(".time-btn");

    btns.forEach(btn => {
      btn.addEventListener("click", async () => {
        const minutes = btn.dataset.minutes;
        const user = await getUser();
        if (!user) return;

        await supabase
          .from("profiles")  // ← CAMBIO AQUÍ
          .update({ preferred_focus_time: `${minutes}_min` })
          .eq("id", user.id);

        goTo("/onboarding/step4.html");
      });
    });

    return;
  }

  /* ---------------------------------------------------
     STEP 4 → Pantalla de carga automática
  --------------------------------------------------- */
  if (path.endsWith("step4.html")) {
    setTimeout(() => {
      goTo("/onboarding/finish.html");
    }, 2000);
    return;
  }

  /* ---------------------------------------------------
     FINISH → Asignar curso y avanzar
  --------------------------------------------------- */
  if (path.endsWith("finish.html")) {
    const btn = document.getElementById("btnFirstLesson");

    if (btn) {
      btn.addEventListener("click", async () => {
        const user = await getUser();
        if (!user) return;

        // 1. Marcar onboarding completado
        await supabase
          .from("profiles")   // ← CAMBIO AQUÍ
          .update({ onboarding_completed: true })
          .eq("id", user.id);

        // 2. Buscar curso-bienvenida
        const { data: course } = await supabase
          .from("courses")
          .select("id, slug")
          .eq("slug", "curso-bienvenida")
          .single();

        // 3. Asignar curso al usuario
        await supabase
          .from("user_courses")
          .insert({
            user_id: user.id,
            course_id: course.id,
            status: "active"
          })
          .catch(() => {}); // Ignora duplicados

        // 4. Redirigir
        goTo(`/curso/index.html?c=${course.slug}`);
      });
    }

    return;
  }
});

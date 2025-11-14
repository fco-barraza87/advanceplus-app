import { supabase } from "/js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {

  const btn = document.getElementById("btnFirstLesson");

  if (!btn) return; // ← evita errores si no estás en finish

  btn.addEventListener("click", async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1) Marcar onboarding completado
    await supabase
      .from("users")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    // 2) Buscar el curso-bienvenida
    const { data: course } = await supabase
      .from("courses")
      .select("id, slug")
      .eq("slug", "curso-bienvenida")
      .single();

    // 3) Asignar el curso al usuario
    await supabase
      .from("user_courses")
      .insert({
        user_id: user.id,
        course_id: course.id,
        status: "active"
      })
      .catch(() => {});

    // 4) Redirigir a la primera lección
    window.location.href = `/curso/index.html?c=${course.slug}`;
  });
});

// /js/router.js  
// Router dinámico Advance+ (usuarios fríos + compradores)
// Detecta: sesión, onboarding, cursos comprados, cursos gratuitos
// Redirige automáticamente a la vista correcta

import { supabase } from "./supabase.js";

/* ------------------------------------------------------------
   FUNCIONES BASE
------------------------------------------------------------ */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from("users")
    .select("onboarding_completed")
    .eq("id", userId)
    .single();
  return data;
}

export async function getUserCourses(userId) {
  const { data } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  return data || [];
}

/* ------------------------------------------------------------
   ROUTER PRINCIPAL
   Lógica de flujo:
   1. Si NO hay sesión → login
   2. Si usuario sin cursos Y onboarding incompleto → onboarding
   3. Si usuario con cursos → ir directo al curso
   4. Si usuario sin cursos pero onboarding completo → dashboard
------------------------------------------------------------ */
export async function runRouter() {
  // 1) Verificar sesión
  const user = await getUser();
  if (!user) {
    console.log("⛔ No hay sesión → /index.html");
    window.location.href = "/index.html";
    return;
  }

  // 2) Obtener perfil
  const profile = await getProfile(user.id);
  const onboardingCompleted = profile?.onboarding_completed || false;

  // 3) Ver cursos del usuario
  const userCourses = await getUserCourses(user.id);
  const hasCourses = userCourses.length > 0;

  console.log({ onboardingCompleted, hasCourses, userCourses });

  /* ------------------------------------------------------------
     CASO A) Usuario frío (sin cursos + sin onboarding)
  ------------------------------------------------------------ */
  if (!hasCourses && !onboardingCompleted) {
    console.log("❄️ Usuario frío → onboarding");
    window.location.href = "/onboarding/step1.html";
    return;
  }

  /* ------------------------------------------------------------
     CASO B) Usuario comprador (tiene cursos)
     Ir al primer curso activo automáticamente
  ------------------------------------------------------------ */
  if (hasCourses) {
    const firstCourse = userCourses[0].course_id;
    console.log("🔥 Usuario comprador → curso", firstCourse);
    window.location.href = `/curso/index.html?c=${firstCourse}`;
    return;
  }

  /* ------------------------------------------------------------
     CASO C) Usuario sin cursos pero con onboarding terminado → dashboard
  ------------------------------------------------------------ */
  if (!hasCourses && onboardingCompleted) {
    console.log("📘 Usuario sin cursos pero onboarding OK → dashboard");
    window.location.href = "/dashboard/index.html";
    return;
  }
}

/* ------------------------------------------------------------
   EJECUCIÓN AUTOMÁTICA
   (Las vistas protegidas llaman a: runRouter())
------------------------------------------------------------ */
export async function protectView() {
  await runRouter();
}

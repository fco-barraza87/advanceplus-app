console.log("🔥 router.js CARGÓ CORRECTAMENTE");

import { supabase } from "./supabase.js";

/* ==========================================
   NO REDIRIGIR SI ESTAMOS EN RUTA DE ADMIN
========================================== */
const ADMIN_PATH = "/admin/";

if (window.location.pathname.startsWith(ADMIN_PATH)) {
  console.log("Router desactivado en /admin/");
}

/* ==========================================
   FUNCIÓN FALTANTE PARA EVITAR EL ERROR
   Esta función es usada por index.html,
   dashboard.html, onboarding, etc.
========================================== */
export async function protectUserView() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "/index.html";
  }
}

/* BASE */
export async function getUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed, role")
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

/* ==========================================
   ROUTER PRINCIPAL (solo usuarios)
========================================== */
export async function runRouter() {
  if (window.location.pathname.startsWith(ADMIN_PATH)) return;

  // 1. Obtener usuario autenticado
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  // 2. Obtener su perfil
  const profile = await getProfile(user.id);

  // 3. Si es ADMIN → redirigir al dashboard de admin
  if (profile?.role === "admin") {
    window.location.href = "/admin/index.html";
    return;
  }

  // 4. Si es COACH → redirigir al dashboard de coach
  if (profile?.role === "coach") {
    window.location.href = "/coach/index.html";
    return;
  }

  // 5. Usuarios normales (user)
  const onboardingCompleted = profile?.onboarding_completed || false;
  const userCourses = await getUserCourses(user.id);
  const hasCourses = userCourses.length > 0;

  if (!hasCourses && !onboardingCompleted) {
    window.location.href = "/onboarding/step1.html";
    return;
  }

  if (hasCourses) {
    const firstCourse = userCourses[0].course_id;
    window.location.href = `/curso/index.html?c=${firstCourse}`;
    return;
  }

  if (!hasCourses && onboardingCompleted) {
    window.location.href = "/dashboard/index.html";
    return;
  }
}


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

/* ===========================================
   ROUTER PRINCIPAL (solo usuarios)
=========================================== */

const ADMIN_PATH = "/admin/";

export async function runRouter() {

  console.log("🔥 router corriendo en:", window.location.pathname);

  // 1. Si ya estamos en /admin/, NO redirigir al admin
  if (window.location.pathname.startsWith(ADMIN_PATH)) {
    console.log("🟡 Estamos en admin, router no redirige.");
    return;
  }

  // 2. Obtener user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  // 3. Obtener perfil
  const profile = await getProfile(user.id);
  console.log("Perfil:", profile);

  // 4. ADMIN → redirigir SIEMPRE
  if (profile?.role === "admin") {
    console.log("🔴 Admin detectado → Redirigiendo a /admin/index.html");
    window.location.href = "/admin/index.html";
    return;
  }

  // 5. COACH → redirigir
  if (profile?.role === "coach") {
    console.log("🟣 Coach detectado → Redirigiendo a /coach/index.html");
    window.location.href = "/coach/index.html";
    return;
  }

  // 6. Usuarios normales → flujo estándar
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



import { supabase } from "./supabase.js";

/* ==========================================
   NO REDIRIGIR SI ESTAMOS EN RUTA DE ADMIN
========================================== */
const ADMIN_PATH = "/admin/";

if (window.location.pathname.startsWith(ADMIN_PATH)) {
  // no correr router, no redirigir
  console.log("Router desactivado en /admin/");
}

/* BASE */
export async function getUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
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

/* ROUTER PRINCIPAL (solo usuarios) */
export async function runRouter() {
  if (window.location.pathname.startsWith(ADMIN_PATH)) return;

  const user = await getUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  const profile = await getProfile(user.id);
  const onboardingCompleted = profile?.onboarding_completed || false;

  // ⛔ No redirigir admins/coaches
  if (profile?.role === "admin" || profile?.role === "coach") return;

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

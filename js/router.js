// /js/router.js
import { supabase } from "./supabase.js";

/* BASE */
export async function getUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")             // <-- antes ponías "users"
    .select("onboarding_completed")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error getProfile:", error);
    return null;
  }

  return data;
}

export async function getUserCourses(userId) {
  const { data, error } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error getUserCourses:", error);
    return [];
  }

  return data || [];
}

/* ROUTER PRINCIPAL */
export async function runRouter() {
  const user = await getUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  const profile = await getProfile(user.id);
  const onboardingCompleted = profile?.onboarding_completed || false;

  const userCourses = await getUserCourses(user.id);
  const hasCourses = userCourses.length > 0;

  // A) Usuario frío
  if (!hasCourses && !onboardingCompleted) {
    window.location.href = "/onboarding/step1.html";
    return;
  }

  // B) Usuario con cursos
  if (hasCourses) {
    const firstCourse = userCourses[0].course_id;
    window.location.href = `/curso/index.html?c=${firstCourse}`;
    return;
  }

  // C) Sin cursos pero onboarding OK
  if (!hasCourses && onboardingCompleted) {
    window.location.href = "/dashboard/index.html";
    return;
  }
}

/* Vistas que solo necesitan verificar sesión */
export async function protectUserView() {
  const user = await getUser();
  if (!user) {
    window.location.href = "/index.html";
  }
}

/* Alias antiguo (si lo usas en alguna parte) */
export async function protectView() {
  await runRouter();
}


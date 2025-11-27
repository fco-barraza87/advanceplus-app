import { supabase } from "./supabase.js";

/* ========== SESSION ========= */

export async function getUser() {
  const { data: { session }} = await supabase.auth.getSession();
  return session?.user || null;
}


export async function protectUserView() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  // cargar el perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // si es admin, no debe estar aquí
  if (profile?.role === "admin") {
    window.location.href = "/admin/index.html";
  }
}


/* ========== PROFILE (solo lo necesario) ========= */

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error getProfile:", error);
    return null;
  }

  return data;
}

/* ========== USER COURSES ========= */

export async function getUserCourses(userId) {
  const { data, error } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error getUserCourses:", error);
    return [];
  }

  return data;
}

/* ========== ROUTER PRINCIPAL ========= */

export async function runRouter() {
  const user = await getUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  // el rol ahora viene del JWT 🎉
  const role = user.app_metadata?.role || "user";

  if (role === "admin" || role === "coach") {
    window.location.href = "/admin/index.html";
    return;
  }

  const profile = await getProfile(user.id);
  const onboardingCompleted = profile?.onboarding_completed || false;

  const userCourses = await getUserCourses(user.id);
  const hasCourses = userCourses.length > 0;

  if (!hasCourses && !onboardingCompleted) {
    window.location.href = "/onboarding/step1.html";
    return;
  }

  if (hasCourses) {
    window.location.href = `/curso/index.html?c=${userCourses[0].course_id}`;
    return;
  }

  window.location.href = "/dashboard/index.html";
}

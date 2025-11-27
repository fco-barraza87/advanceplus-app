console.log("🔥 router.js cargó correctamente");

import { supabase } from "./supabase.js";

/* ======================================
   PROTEGER VISTA — SOLO VERIFICA SESIÓN
====================================== */
export async function protectUserView() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "/index.html";
  }
}

/* ======================================
   BASE
====================================== */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserRole() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.app_metadata?.role || "user";
}

export async function getUserCourses(userId) {
  const { data } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId);

  return data || [];
}

/* ======================================
   RUTAS BASE PARA EVITAR LOOPS
====================================== */
const ADMIN_PATH = "/admin/";
const COACH_PATH = "/coach/";
const DASHBOARD_PATH = "/dashboard/";

/* ======================================
   ROUTER PRINCIPAL
====================================== */
export async function runRouter() {
  console.log("🚦 Router ejecutándose en:", window.location.pathname);

  // 1. Verificar sesión
  const user = await getCurrentUser();
  if (!user) {
    console.log("🔴 No hay usuario → index");
    window.location.href = "/index.html";
    return;
  }

  // 2. Obtener rol
  const role = await getUserRole();
  console.log("👤 Rol detectado:", role);

  const currentPath = window.location.pathname;

  /* ======================================
     3. SI YA ESTÁ EN SU DESTINO → NO REDIRIGE
  ====================================== */

  // User en dashboard
  if (role === "user" && currentPath.startsWith(DASHBOARD_PATH)) {
    console.log("🟢 Usuario ya está en dashboard → router no actúa");
    return;
  }

  // Admin en admin
  if (role === "admin" && currentPath.startsWith(ADMIN_PATH)) {
    console.log("🟢 Admin ya está en /admin/ → router no actúa");
    return;
  }

  // Coach en coach
  if (role === "coach" && currentPath.startsWith(COACH_PATH)) {
    console.log("🟢 Coach ya está en /coach/ → router no actúa");
    return;
  }

  /* ======================================
     4. REDIRECCIÓN PRINCIPAL (solo si están no están en destino)
  ====================================== */

  if (role === "admin") {
    console.log("🔴 Admin detectado → /admin/index.html");
    window.location.href = "/admin/index.html";
    return;
  }

  if (role === "coach") {
    console.log("🟣 Coach detectado → /coach/index.html");
    window.location.href = "/coach/index.html";
    return;
  }

  // Usuario normal → dashboard
  console.log("🔵 Usuario detectado → /dashboard/index.html");
  window.location.href = "/dashboard/index.html";
}

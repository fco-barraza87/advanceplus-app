// auth.js
import { supabase } from "./supabase.js";

/* -----------------------------------------------------
   AUTH CORE – Sesión
----------------------------------------------------- */

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
}

supabase.auth.onAuthStateChange(async (event) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "/index.html";
  }
});

/* -----------------------------------------------------
   ROLE ACCESS — usando JWT, no SELECT a profiles
----------------------------------------------------- */

export async function getUserRole() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.app_metadata?.role || "user";
}

/* YA NO CONSULTAMOS LA TABLA profiles para el ROL */

/* -----------------------------------------------------
   Protecciones de acceso
----------------------------------------------------- */

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/index.html";
    return null;
  }
  return user;
}

export async function requireAdmin() {
  await requireAuth();
  const role = await getUserRole();

  if (role !== "admin") {
    alert("Acceso denegado.");
    window.location.href = "/dashboard/index.html";
  }
}

export async function requireCoach() {
  await requireAuth();
  const role = await getUserRole();

  if (role !== "coach") {
    alert("Acceso exclusivo para coaches.");
    window.location.href = "/dashboard/index.html";
  }
}

export async function requireUser() {
  await requireAuth();
  const role = await getUserRole();

  if (role !== "user") {
    alert("Acceso denegado.");
    window.location.href = "/dashboard/index.html";
  }
}

/* -----------------------------------------------------
   Información mínima para UI/header
----------------------------------------------------- */
export async function loadUserMinimalInfo() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: { session } } = await supabase.auth.getSession();
  const role = session?.user?.app_metadata?.role || "user";

  // YA NO LEES LA TABLA profiles PARA EL ROL
  return {
    id: user.id,
    email: user.email,
    name: user.email.split("@")[0],  // o luego lo completamos con profile
    role,
    avatar: null
  };
}

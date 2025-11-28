// /js/auth.js
import { supabase } from "./supabase.js";

/* -----------------------------------------------------
   AUTH CORE – Sesión
----------------------------------------------------- */

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getUser:", error);
    return null;
  }
  return data.user;
}

/* -----------------------------------------------------
   ROLE ACCESS — usando tabla profiles.role
   (NO leemos app_metadata, NO manipulamos JWT)
----------------------------------------------------- */

export async function getUserRole() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.warn("Error leyendo profiles.role, se asume 'user':", error);
    return "user";
  }

  return data?.role || "user";
}

/* -----------------------------------------------------
   Protecciones de acceso
----------------------------------------------------- */

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/login.html"; // o "/index.html" según tu flujo
    return null;
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return;

  const role = await getUserRole();
  if (role !== "admin") {
    alert("Acceso exclusivo para administradores.");
    window.location.href = "/dashboard/index.html";
  }
}

export async function requireCoach() {
  const user = await requireAuth();
  if (!user) return;

  const role = await getUserRole();
  if (role !== "coach" && role !== "admin") {
    // admin también puede ver vista de coach si quieres
    alert("Acceso exclusivo para coaches.");
    window.location.href = "/dashboard/index.html";
  }
}

export async function requireUser() {
  const user = await requireAuth();
  if (!user) return;

  const role = await getUserRole();
  if (role !== "user") {
    alert("Acceso exclusivo para usuarios estándar.");
    window.location.href = "/dashboard/index.html";
  }
}

/* -----------------------------------------------------
   Información mínima para UI/header
----------------------------------------------------- */

export async function loadUserMinimalInfo() {
  const user = await getCurrentUser();
  if (!user) return null;

  const role = await getUserRole();

  return {
    id: user.id,
    email: user.email,
    name: user.email?.split("@")[0] || "Usuario",
    role,
    avatar: null
  };
}

/* -----------------------------------------------------
   Logout
----------------------------------------------------- */

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/login.html"; // o "/index.html" según tu flujo
}

// Opcional: redirigir si se desloguea en otra pestaña
supabase.auth.onAuthStateChange(async (event) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "/login.html";
  }
});

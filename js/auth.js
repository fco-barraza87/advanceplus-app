// auth.js
import { supabase } from "./supabase.js";

/* -----------------------------------------------------
   AUTH CORE – Manejo centralizado de sesión
----------------------------------------------------- */

/**
 * Obtiene el usuario autenticado.
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Cierra sesión global.
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
}

/**
 * Escucha cambios de sesión (login, logout, refresh).
 */
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "/index.html";
  }
});


/* -----------------------------------------------------
   VALIDACIONES DE ACCESO (Role-Based Access)
----------------------------------------------------- */

/**
 * Devuelve perfil completo desde la tabla users.
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role, avatar_url, xp_total, streak_current")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error cargando perfil:", error);
    return null;
  }

  return data;
}


/**
 * Asegura que el usuario esté autenticado.
 * Si no lo está → redirige al login.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/index.html";
    return null;
  }
  return user;
}

/**
 * Asegura que el usuario sea ADMIN.
 */
export async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getUserProfile(user.id);
  if (profile.role !== "admin") {
    alert("Acceso denegado.");
    window.location.href = "/dashboard/index.html";
  }

  return profile;
}


/**
 * Asegura que el usuario sea COACH.
 */
export async function requireCoach() {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getUserProfile(user.id);
  if (profile.role !== "coach") {
    alert("Acceso exclusivo para coaches.");
    window.location.href = "/dashboard/index.html";
  }

  return profile;
}


/**
 * Asegura que el usuario sea USER normal.
 */
export async function requireUser() {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getUserProfile(user.id);
  if (profile.role !== "user") {
    alert("Acceso denegado.");
    window.location.href = "/dashboard/index.html";
  }

  return profile;
}


/* -----------------------------------------------------
   Carga rápida de datos del usuario (para headers/UI)
----------------------------------------------------- */

export async function loadUserMinimalInfo() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await getUserProfile(user.id);

  return {
    id: user.id,
    email: user.email,
    name: profile.full_name,
    role: profile.role,
    avatar: profile.avatar_url,
  };
}


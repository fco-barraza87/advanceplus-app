// /js/auth.js
import { supabase } from "./supabase.js";

/* ============================================================
   SIGN UP — Registro seguro
   Crea el usuario en auth y el perfil (si procede)
============================================================ */
export async function signUp(email, password, full_name = "") {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name }
    }
  });

  if (error) throw new Error(error.message);

  return data;
}

/* ============================================================
   SIGN IN — Login con password
============================================================ */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw new Error(error.message);

  return data;
}

/* ============================================================
   LOGOUT — Cierre de sesión seguro
============================================================ */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/auth/login.html";
}

/* ============================================================
   Obtener solo usuario (auth)
============================================================ */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/* ============================================================
   Obtener usuario + perfil
   (Usado por header, router y dashboard)
============================================================ */
export async function getCurrentUserWithProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const user = auth.user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return { user, profile: null };

  return { user, profile };
}

/* ============================================================
   Escuchar cambios de sesión (login/logout/tab-change)
============================================================ */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// /js/auth.js

import { supabase } from "./supabase.js";

/* ============================================================
   SIGN UP — Registro de usuario
   Se crea el usuario en auth y el perfil en profiles
============================================================ */
export async function signUp(email, password, full_name = "") {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name
      }
    }
  });

  if (error) throw error;

  return data;
}

/* ============================================================
   SIGN IN — Login
============================================================ */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  return data;
}

/* ============================================================
   LOGOUT
============================================================ */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/auth/login.html";
}

/* ============================================================
   Obtener usuario actual (auth)
============================================================ */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/* ============================================================
   Obtener usuario + perfil
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

  if (error) return null;

  return { user, profile };
}

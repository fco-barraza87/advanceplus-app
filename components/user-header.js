// ===============================================================
//  HEADER USUARIO — Versión Final Optimizada
// ===============================================================

import { supabase } from "/js/supabase.js";

export async function loadUserHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  // 1. Cargar HTML del header
  const res = await fetch("/components/header.html");
  container.innerHTML = await res.text();

  // 2. Cargar perfil
  await renderUserHeaderData();
}

// ===============================================================
//  RENDER: Nombre + Rol + Avatar
// ===============================================================
async function renderUserHeaderData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  // Nombre
  const name = document.getElementById("headerUserName");
  if (name) name.textContent = profile.full_name;

  // Rol
  const role = document.getElementById("headerUserRole");
  if (role) {
    role.textContent =
      profile.role === "admin" ? "Administrador"
      : profile.role === "coach" ? "Coach"
      : "Miembro Advance+";
  }

  // Avatar
  const avatar = document.getElementById("headerAvatar");
  if (avatar && profile.avatar_url) {
    avatar.style.backgroundImage = `url('${profile.avatar_url}')`;
    avatar.style.color = "transparent";
  }
}

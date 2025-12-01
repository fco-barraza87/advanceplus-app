// /admin/admin.js
import { supabase } from "/js/supabase.js";
import { requireAuth } from "/js/auth.js";

/**
 * Verifica que el usuario esté autenticado y sea admin.
 * Si no lo es, lo redirige fuera del área admin.
 */
export async function requireAdmin() {
  const user = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error cargando perfil:", error);
    alert("No se pudo cargar tu perfil. Intenta nuevamente.");
    window.location.href = "/dashboard/index.html";
    throw error;
  }

  if (!profile || profile.role !== "admin") {
    alert("No tienes permisos para acceder al panel admin.");
    window.location.href = "/dashboard/index.html";
    throw new Error("Not admin");
  }

  return { user, profile };
}

/**
 * Renderiza un título simple al inicio de la página admin.
 */
export function setAdminHeader(title, subtitle = "") {
  const container = document.querySelector(".admin-page-header");
  if (!container) return;

  container.innerHTML = `
    <div>
      <h1 class="admin-title">${title}</h1>
      ${subtitle ? `<p class="admin-subtitle">${subtitle}</p>` : ""}
    </div>
  `;
}

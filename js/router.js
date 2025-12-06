// /js/router.js

import { getCurrentUserWithProfile } from "./auth.js";

/**
 * Protege una página según roles permitidos.
 * 
 * Example:
 * protectPage({ allowedRoles: ["user"] });
 * protectPage({ allowedRoles: ["admin"] });
 */
export async function protectPage({ allowedRoles = [] } = {}) {
  
  const data = await getCurrentUserWithProfile();

  // No hay sesión → login
  if (!data) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { profile } = data;

  // Si no cumple el rol → enviar a su dashboard correcto
  if (!allowedRoles.includes(profile.role)) {
    redirectByRole(profile.role);
    return;
  }
}

/* ============================================================
   Redirección automática según rol
============================================================ */
export function redirectByRole(role) {
  switch (role) {
    case "admin":
      window.location.href = "/dashboard/admin.html";
      break;

    case "coach":
      window.location.href = "/dashboard/coach.html";
      break;

    default:
      window.location.href = "/dashboard/index.html";
  }
}

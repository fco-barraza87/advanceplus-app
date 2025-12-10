// /js/router.js
import { getCurrentUserWithProfile } from "./auth.js";

/* ============================================================
   PROTEGER UNA PÁGINA (por rol)
   Example:
      protectPage({ allowedRoles: ["user"] });
============================================================ */
export async function protectPage({ allowedRoles = [] } = {}) {
  const data = await getCurrentUserWithProfile();

  // No está logueado → login
  if (!data || !data.profile) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { profile } = data;

  // Si el rol del usuario no está permitido → redirigir
  if (!allowedRoles.includes(profile.role)) {
    redirectByRole(profile.role);
    return;
  }
}

/* ============================================================
   REDIRECCIÓN SEGÚN ROL
============================================================ */
export function redirectByRole(role = "user") {
  const routes = {
    admin: "/admin/index.html",
    coach: "/dashboard/coach.html",
    user: "/dashboard/index.html",
  };

  window.location.href = routes[role] ?? routes.user;
}

/* ============================================================
   REDIRECCIÓN SI YA HAY UNA SESIÓN ACTIVA
   (útil para login y register)
============================================================ */
export async function redirectIfLoggedIn() {
  const data = await getCurrentUserWithProfile();
  if (data && data.profile) {
    redirectByRole(data.profile.role);
  }
}

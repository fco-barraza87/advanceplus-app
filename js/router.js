/* ============================================================
   ROUTER AVANZADO A+ — 2025
   Controla navegación interna, permisos y redirecciones limpias
   Funciona con la tabbar y con vistas protegidas
============================================================ */

import { supabase } from "/js/supabase.js";

/* ============================================================
   🔐 PROTECCIÓN DE VISTAS 
   - Bloquea acceso si no hay sesión
   - Redirige al login
============================================================ */
export async function protectUserView() {
  const { data: session } = await supabase.auth.getUser();

  if (!session?.user) {
    window.location.href = "/auth/login.html";
    return;
  }

  // Activa la tabbar correcta
  highlightActiveTab();
}

/* ============================================================
   🧭 MAPA DE RUTAS OFICIALES
   (Permite centralizar cambios más adelante)
============================================================ */
export const ROUTES = {
  dashboard: "/dashboard/index.html",
  courses: "/retos/index.html",
  profile: "/dashboard/datos.html",
  stats: "/progreso/index.html",
};

/* ============================================================
   🚀 NAVEGACIÓN DESDE LA TABBAR
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (!target || !ROUTES[target]) return;

      // Evita recarga innecesaria
      if (window.location.pathname === ROUTES[target]) return;

      window.location.href = ROUTES[target];
    });
  });
});

/* ============================================================
   ⭐ MARCAR TAB ACTIVA AUTOMÁTICAMENTE
============================================================ */
export function highlightActiveTab() {
  const current = window.location.pathname;
  const tabButtons = document.querySelectorAll(".tab-btn");

  tabButtons.forEach(btn => {
    const target = btn.dataset.nav;
    if (!target) return;

    if (ROUTES[target] === current) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/* ============================================================
   🧹 LIMPIADOR DE URL (remove ?id=…)
   Opcional: dejar URLs más limpias
============================================================ */
export function cleanURL() {
  const url = new URL(window.location);
  if (url.search) {
    window.history.replaceState({}, "", url.pathname);
  }
}

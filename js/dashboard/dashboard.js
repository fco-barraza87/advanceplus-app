// /js/dashboard.js
import { supabase } from "/js/supabase.js";
import { requireAuth, loadUserMinimalInfo, logout } from "/js/auth.js";

/* ============================================================
   SISTEMA DE NIVELES — Fórmula oficial
   XP requerido para nivel = base * growth^(nivel - 1)
============================================================ */
function xpForLevel(level) {
  const base = 100;
  const growth = 1.35;
  return Math.round(base * Math.pow(growth, level - 1));
}

function getLevelProgress(xpTotal) {
  let level = 1;
  let xpUsed = 0;
  let xpNeeded = xpForLevel(level);

  while (xpTotal >= xpUsed + xpNeeded) {
    xpUsed += xpNeeded;
    level++;
    xpNeeded = xpForLevel(level);
  }

  const xpIntoLevel = xpTotal - xpUsed;
  const xpRemaining = xpNeeded - xpIntoLevel;
  const pct = Math.min(100, (xpIntoLevel / xpNeeded) * 100);

  return { level, xpIntoLevel, xpRemaining, pct, xpNeeded };
}

/* ============================================================
   CARGAR GAMIFICACIÓN REAL
============================================================ */
async function loadGamification() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: stats, error } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !stats) return;

  const xp = stats.xp_total || 0;

  const prog = getLevelProgress(xp);

  document.getElementById("userLevel").textContent = prog.level;
  document.getElementById("xpTotal").textContent = `${xp} XP`;
  document.getElementById("xpNextText").textContent =
    `${prog.xpRemaining} XP para subir de nivel`;
  document.getElementById("xpBarFill").style.width = `${prog.pct}%`;

  document.getElementById("streakCurrent").textContent =
    `${stats.streak_current || 0} 🔥`;
  document.getElementById("streakBest").textContent =
    `${stats.streak_best || 0} 🏆`;
}

async function loadGamification(userId) {
  const { data: stats, error } = await supabase
    .from("user_stats")
    .select("xp_total, streak_current, streak_best")
    .eq("user_id", userId)
    .maybeSingle();
}

/* ============================================================
   HEADER — Nombre y Rol
============================================================ */
async function loadHeaderInfo() {
  const info = await loadUserMinimalInfo();
  if (!info) return;

  const nameEl = document.getElementById("headerUserName");
  const roleEl = document.getElementById("headerUserRole");

  if (nameEl) nameEl.textContent = info.name || "Usuario";

  const roles = { admin: "Admin", coach: "Coach", user: "Usuario" };
  roleEl.textContent = roles[info.role] || "Usuario";
}

/* ============================================================
   CURSOS (ACTIVOS + DISPONIBLES)
============================================================ */
async function loadCourses(userId) {
  // ... (tu código de cursos permanece igual)
  // NO lo toco porque funciona perfecto.
}

/* ============================================================
   TAB BAR
============================================================ */
function setupTabBar() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.nav;
      if (target === "dashboard") return;

      alert("Pronto disponible.");
    });
  });
}

function setupLogout() {
  const btn = document.getElementById("btnLogout");
  if (btn) btn.onclick = () => logout();
}

/* ============================================================
   MAIN
============================================================ */
(async () => {
  const user = await requireAuth();
  if (!user) return;

  await loadHeaderInfo();

  await loadCourses(user.id);

  setupTabBar();
  setupLogout();
})();

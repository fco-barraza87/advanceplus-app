// /js/dashboard-user.js

import { getCurrentUserWithProfile } from "./auth.js";

/* ============================================================
   Fórmula de XP y niveles (reutilizada)
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
   Inicializar Dashboard User
============================================================ */
async function initDashboard() {
  const data = await getCurrentUserWithProfile();
  if (!data) return;
  const { profile } = data;

  renderGamification(profile);
  renderMissionPlaceholder();
  renderChallengesPlaceholder();
}

function renderGamification(profile) {
  const xpTotal = profile.xp_total ?? 0;
  const streakCurrent = profile.streak_current ?? 0;
  const streakBest = profile.streak_best ?? 0;

  // Streak
  const streakCurrentEl = document.getElementById("streakCurrent");
  const streakBestEl = document.getElementById("streakBest");
  const streakBarFill = document.getElementById("streakBarFill");

  if (streakCurrentEl) streakCurrentEl.textContent = streakCurrent;
  if (streakBestEl) streakBestEl.textContent = streakBest;

  const goalDays = 21;
  const streakPct = Math.max(0, Math.min(100, (streakCurrent / goalDays) * 100));
  if (streakBarFill) streakBarFill.style.width = `${streakPct}%`;

  // XP / Nivel
  const { level, xpIntoLevel, xpRemaining, pct, xpNeeded } = getLevelProgress(xpTotal);

  const levelEl = document.getElementById("userLevel");
  const xpThisLevelEl = document.getElementById("xpThisLevel");
  const nextLevelEl = document.getElementById("nextLevel");
  const xpFillEl = document.getElementById("xpFill");

  if (levelEl) levelEl.textContent = level;
  if (xpThisLevelEl) xpThisLevelEl.textContent = `${xpIntoLevel} / ${xpNeeded} XP`;
  if (nextLevelEl) nextLevelEl.textContent = `Siguiente: Nivel ${level + 1}`;
  if (xpFillEl) xpFillEl.style.width = `${pct}%`;
}

/* ============================================================
   Misión del día (placeholder mientras no haya DB de cursos)
============================================================ */
function renderMissionPlaceholder() {
  const missionCard = document.getElementById("missionCard");
  const promoCard = document.getElementById("missionPromoCard");
  const missionMeta = document.getElementById("missionMeta");
  const missionTitle = document.getElementById("missionTitle");
  const missionDesc = document.getElementById("missionDesc");
  const missionBtn = document.getElementById("missionBtn");
  const missionPromoBtn = document.getElementById("missionPromoBtn");

  // De momento mostramos un estado neutro hasta integrar DB real
  if (missionMeta) missionMeta.textContent = "Próximamente";
  if (missionTitle) missionTitle.textContent = "Tu próxima misión está en camino";
  if (missionDesc) missionDesc.textContent = "Muy pronto verás aquí la misión diaria de tu reto activo.";

  if (missionBtn) {
    missionBtn.addEventListener("click", () => {
      // Más adelante: ir a la lección actual del curso activo
      window.location.href = "/curso/index.html";
    });
  }

  if (missionPromoBtn) {
    missionPromoBtn.addEventListener("click", () => {
      window.location.href = "/curso/index.html";
    });
  }

  // Por ahora, asumimos que no hay lógica real de curso activo
  if (missionCard) missionCard.style.display = "block";
  if (promoCard) promoCard.style.display = "none";
}

/* ============================================================
   Retos activos / Explorar retos (placeholders)
   Más adelante se conectan a las tablas reales de cursos.
============================================================ */
function renderChallengesPlaceholder() {
  const activeCarousel = document.getElementById("activeChallengesCarousel");
  const activeCountEl = document.getElementById("activeChallengesCount");
  const noActiveEl = document.getElementById("noActiveChallenges");

  const coursesGrid = document.getElementById("coursesGrid");
  const noAvailableEl = document.getElementById("noAvailableMessage");

  // De momento, mostramos que no hay retos activos.
  if (activeCarousel) activeCarousel.innerHTML = "";
  if (activeCountEl) activeCountEl.textContent = "0 activos";
  if (noActiveEl) noActiveEl.style.display = "block";

  if (coursesGrid) {
    coursesGrid.innerHTML = `
      <div class="course-card placeholder">
        <h3>Muy pronto</h3>
        <p>Estamos preparando los retos AI7, AI21 y muchos más para ti.</p>
      </div>
    `;
  }

  if (noAvailableEl) noAvailableEl.style.display = "none";
}

/* ============================================================
   Ejecutar al cargar
============================================================ */
initDashboard();

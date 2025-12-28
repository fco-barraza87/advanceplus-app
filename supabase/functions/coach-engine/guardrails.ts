// guardrails.ts
import type {
  CoachMemoryProposal,
  CoachFactKey,
  CoachMemorySnapshot,
} from "./coach.types.ts";

/* ============================================================
   7.0 — Guardrails existentes (NO TOCAR COMPORTAMIENTO)
============================================================ */

export function needsDerivation(text: string): boolean {
  const redFlags = [
    "mi infancia",
    "mi relación",
    "mi pareja",
    "mi padre",
    "mi madre",
    "trauma",
    "depresión",
    "ansiedad profunda",
    "terapia",
    "psicólogo",
  ];
  return redFlags.some(w => text.includes(w));
}

// Por ahora: sin memoria real (7.0)
export function getTurns(_context: any): number {
  return 1;
}

export function shouldClose(turns: number): boolean {
  return turns >= 5;
}

/* ============================================================
   7.1 — Guardrails de memoria (NUEVO, NO ROMPE 7.0)
============================================================ */

const ALLOWED_FACT_KEYS: CoachFactKey[] = [
  "primary_goal",
  "current_blocker",
  "active_habit",
  "failed_habit",
  "preferred_time",
  "energy_pattern",
  "motivation_trigger",
  "avoidance_pattern",
  "commitment_level",
  "recurring_excuse",
  "last_decision",
  "next_action",
];

const MAX_FACT_LENGTH = 120;
const MAX_THREAD_TURNS = 5;
const THREAD_TTL_DAYS = 30;

/**
 * Sanitiza una propuesta de memoria proveniente del GPT.
 * - Elimina claves no permitidas
 * - Trunca strings
 * - Acepta null como propuesta de eliminación
 * - Nunca lanza errores
 */
export function sanitizeMemoryProposal(
  proposal?: CoachMemoryProposal
): Partial<Record<CoachFactKey, string | null>> {
  const out: Partial<Record<CoachFactKey, string | null>> = {};
  if (!proposal?.facts) return out;

  for (const key of Object.keys(proposal.facts)) {
    if (!ALLOWED_FACT_KEYS.includes(key as CoachFactKey)) continue;

    const val = proposal.facts[key as CoachFactKey];
    out[key as CoachFactKey] =
      typeof val === "string"
        ? val.slice(0, MAX_FACT_LENGTH)
        : null;
  }

  return out;
}

/**
 * Fusiona el thread existente con nuevos turnos,
 * aplicando TTL y límite de longitud.
 */
export function mergeMemoryThread(
  previous: CoachMemorySnapshot | null,
  append: Array<{ role: "user" | "coach"; content: string }> = []
): Array<{ role: "user" | "coach"; content: string }> {

  const now = Date.now();

  const expired =
    previous &&
    now - new Date(previous.updated_at).getTime() >
      THREAD_TTL_DAYS * 24 * 60 * 60 * 1000;

  const baseThread = expired ? [] : previous?.thread ?? [];

  return [...baseThread, ...append].slice(-MAX_THREAD_TURNS);
}

// coach.types.ts
import { CoachLevel } from "./coach.levels.ts";

/* =====================================================
   Runtime Context (INTERNO – no viene del frontend)
===================================================== */
export interface CoachRuntimeContext {
  coachLevel: CoachLevel;
  memory?: CoachMemorySnapshot;
}

/* =====================================================
   Intent (7.0 existente)
===================================================== */
export type CoachIntent =
  | "lesson_observer"
  | "chat";

/* =====================================================
   Input (7.0 – NO TOCAR)
===================================================== */
export interface CoachInput {
  intent: CoachIntent;
  context: any;
  user_input?: string;
}

/* =====================================================
   Output (7.0 – CONTRATO INTACTO)
===================================================== */
export interface CoachOutput {
  text: string;
}

/* =====================================================
   Coach Pro 7.1 – Tipos INTERNOS
===================================================== */

export type CoachFactKey =
  | "primary_goal"
  | "current_blocker"
  | "active_habit"
  | "failed_habit"
  | "preferred_time"
  | "energy_pattern"
  | "motivation_trigger"
  | "avoidance_pattern"
  | "commitment_level"
  | "recurring_excuse"
  | "last_decision"
  | "next_action";

export interface CoachMemorySnapshot {
  facts: Partial<Record<CoachFactKey, string>>;
  thread: Array<{
    role: "user" | "coach";
    content: string;
  }>;
  version: number;
  updated_at: string;
}

/* =====================================================
   GPT → Memory proposal (INTERNO)
===================================================== */
export interface CoachMemoryProposal {
  facts?: Partial<Record<CoachFactKey, string | null>>;
  thread_append?: Array<{
    role: "user" | "coach";
    content: string;
  }>;
}

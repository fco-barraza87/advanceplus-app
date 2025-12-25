// coach.types.ts

import { CoachLevel } from "./coach.levels";

export interface CoachRuntimeContext {
  coachLevel: CoachLevel;
  memory?: CoachMemorySnapshot;
}


export type CoachIntent =
  | "lesson_observer"
  | "chat";

export interface CoachInput {
  intent: CoachIntent;
  context: any;
  user_input?: string;
}

export interface CoachOutput {
  message: string;
  meta?: {
    premium_hint?: boolean;
    premium_cta?: string;
    premium_reason?: string;
  };
}

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

export interface CoachMemoryProposal {
  facts?: Partial<Record<CoachFactKey, string | null>>;
  thread_append?: Array<{
    role: "user" | "coach";
    content: string;
  }>;
}

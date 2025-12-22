// coach.types.ts

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

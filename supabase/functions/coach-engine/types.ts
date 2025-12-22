export type CoachIntent =
  | "lesson_observer"
  | "chat";

export type CoachInput = {
  intent: CoachIntent;
  course_id: string;
  lesson_id: string;
  context?: any;
  user_input?: string | null;
};

export type CoachOutput = {
  message: string;
  meta?: {
    premium_hint?: boolean;
    premium_cta?: string;
    premium_reason?: string;
    close_conversation?: boolean;
  };
};

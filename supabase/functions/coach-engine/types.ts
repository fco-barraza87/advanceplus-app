// coach.types.ts

export type CoachInput = {
  intent: "lesson_observer" | "chat";
  course_id: string;
  lesson_id: string;
  context?: any;
  user_input?: string;
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

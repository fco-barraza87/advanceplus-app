// coach.logic.ts
import type { CoachInput, CoachOutput } from "./coach.types.ts";
import { runCoachDeterministic } from "./coach.deterministic.ts";
import { runCoachGPT } from "./coach.gpt.ts";

const USE_GPT = (Deno.env.get("COACH_USE_GPT") ?? "true") === "true";

export async function runCoachLogic(
  input: CoachInput
): Promise<CoachOutput> {
  if (USE_GPT) {
    try {
      return await runCoachGPT(input);
    } catch (err) {
      console.error("[GPT error → fallback]", err);
      return runCoachDeterministic(input);
    }
  }
  return runCoachDeterministic(input);
}

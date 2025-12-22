// coach.logic.ts
import { CoachInput, CoachOutput } from "./coach.types.ts";
import { runCoachGPT } from "./coach.gpt.ts";
import { runCoachDeterministic } from "./coach.deterministic.ts";

/* ============================================================
   Feature flag
============================================================ */
const USE_GPT = true;

/* ============================================================
   Main orchestrator
============================================================ */
export async function runCoachLogic(
  input: CoachInput
): Promise<CoachOutput> {

  if (USE_GPT) {
    try {
      return await runCoachGPT(input);
    } catch (err) {
      console.error("[coach.gpt fallback]", err);
      return runCoachDeterministic(input);
    }
  }

  return runCoachDeterministic(input);
}

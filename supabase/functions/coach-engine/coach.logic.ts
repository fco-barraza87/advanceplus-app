// coach.logic.ts
import type { CoachInput, CoachOutput } from "./coach.types.ts";
import { runCoachGPT } from "./coach.gpt.ts";
import { runCoachDeterministic } from "./coach.deterministic.ts";

/* ============================================================
   Feature flag GLOBAL
============================================================ */
const USE_GPT = true; // ← APAGAR para volver a 6.x

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
      console.error("[coach.gpt error → fallback]", err);
      return runCoachDeterministic(input);
    }
  }

  return runCoachDeterministic(input);
}

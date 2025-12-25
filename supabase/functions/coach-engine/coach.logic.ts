// coach.logic.ts
import type {
  CoachInput,
  CoachOutput,
  CoachRuntimeContext,
} from "./coach.types.ts";

import { runCoachDeterministic } from "./coach.deterministic.ts";
import { runCoachGPT } from "./coach.gpt.ts";

const USE_GPT = (Deno.env.get("COACH_USE_GPT") ?? "true") === "true";

/* =====================================================
   Build runtime context (7.1 READY, 7.0 SAFE)
===================================================== */
function buildRuntimeContext(input: CoachInput): CoachRuntimeContext {
  /**
   * ⚠️ IMPORTANTE
   * Por ahora:
   * - NO accedemos a DB
   * - NO asumimos userId
   * - NO activamos memoria
   *
   * Esto mantiene 7.0 intacto.
   * En PASO 4/5 este método se extenderá.
   */
  return {
    coachLevel: "basic",
  };
}

/* =====================================================
   Main router
===================================================== */
export async function runCoachLogic(
  input: CoachInput
): Promise<CoachOutput> {

  const runtimeContext = buildRuntimeContext(input);

  // 🔐 Por ahora TODOS son basic → 7.0 puro
  if (USE_GPT) {
    try {
      return await runCoachGPT(input, runtimeContext);
    } catch (err) {
      console.error("[GPT error → fallback]", err);
      return runCoachDeterministic(input);
    }
  }

  return runCoachDeterministic(input);
}

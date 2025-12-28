// coach.logic.ts
import type {
  CoachInput,
  CoachOutput,
  CoachRuntimeContext,
} from "./coach.types.ts";

import { runCoachDeterministic } from "./coach.deterministic.ts";
import { runCoachGPT } from "./coach.gpt.ts";

import {
  sanitizeMemoryProposal,
  mergeMemoryThread,
} from "./guardrails.ts";

import {
  loadMemory,
  upsertMemory,
} from "./coach.memory.repo.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ============================================================
   ENV
============================================================ */
const USE_GPT = (Deno.env.get("COACH_USE_GPT") ?? "true") === "true";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/* ============================================================
   Runtime context
============================================================ */
async function buildRuntimeContext(
  input: CoachInput
): Promise<CoachRuntimeContext> {

  const userId: string | undefined =
    (input as any)?.context?.user_id;

  if (!userId) {
    return { coachLevel: "basic" };
  }

  try {
    const { data } = await supabase
      .from("user_coach_access")
      .select("active, level")
      .eq("user_id", userId)
      .single();

    if (data?.active && data.level) {
      return { coachLevel: data.level };
    }

  } catch (err) {
    console.error("[coach.access]", err);
  }

  return { coachLevel: "basic" };
}

/* ============================================================
   Heurísticas determinísticas mínimas (BACKEND GARANTIZA)
============================================================ */
function deriveFactsFromUserText(text: string) {
  const facts: Record<string, string> = {};

  if (/mañana|madrugada|temprano|6:00/i.test(text)) {
    facts.preferred_time = "mañana";
  }

  if (/siempre me cuesta|me cuesta|me cuesta mucho/i.test(text)) {
    facts.current_blocker = "dificultad para iniciar";
  }

  if (/voy a|decido|haré|me comprometo/i.test(text)) {
    facts.last_decision = text.slice(0, 120);
  }

  return facts;
}

/* ============================================================
   Main logic
============================================================ */
export async function runCoachLogic(
  input: CoachInput
): Promise<CoachOutput> {

  const runtimeContext = await buildRuntimeContext(input);

  if (!USE_GPT) return runCoachDeterministic(input);

  const userId: string | undefined =
    (input as any)?.context?.user_id;

  let memory = null;

  // 🧠 Cargar memoria SOLO si Pro
  if (runtimeContext.coachLevel === "pro" && userId) {
    memory = await loadMemory(userId);
  }

  try {
    const result = await runCoachGPT(input, {
      ...runtimeContext,
      memory,
    });

    /* ======================================================
       🧠 PERSISTENCIA PRO (GARANTIZADA)
    ====================================================== */
    if (runtimeContext.coachLevel === "pro" && userId) {

      let nextFacts = { ...(memory?.facts ?? {}) };
      let nextThread = memory?.thread ?? [];

      // 1️⃣ Propuesta del GPT (si existe)
      if ((result as any)?.memory_proposal) {
        const sanitizedFacts = sanitizeMemoryProposal(
          (result as any).memory_proposal
        );

        nextFacts = {
          ...nextFacts,
          ...sanitizedFacts,
        };

        nextThread = mergeMemoryThread(
          memory,
          (result as any).memory_proposal?.thread_append
        );
      }

      // 2️⃣ Fallback determinístico (SIEMPRE)
      if (
        input.intent === "chat" &&
        typeof input.user_input === "string"
      ) {
        const derived = deriveFactsFromUserText(input.user_input);
        nextFacts = { ...nextFacts, ...derived };

        nextThread = mergeMemoryThread(memory, [
          { role: "user", content: input.user_input },
        ]);
      }

      // 3️⃣ Guardar SOLO si hay algo real
      if (
        Object.keys(nextFacts).length > 0 ||
        nextThread.length > 0
      ) {
        await upsertMemory(userId, {
          facts: nextFacts,
          thread: nextThread,
          version: 1,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // ⚠️ CONTRATO 7.0
    return { text: result.text };

  } catch (err) {
    console.error("[GPT error → fallback]", err);
    return runCoachDeterministic(input);
  }
}

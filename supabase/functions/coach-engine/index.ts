import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { runCoachLogic } from "./coach.logic.ts";
import type { CoachInput } from "./types.ts";

/* ============================================================
   CORS
============================================================ */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ============================================================
   Handler
============================================================ */
serve(async (req) => {
  try {
    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse body
    const body = (await req.json().catch(() => null)) as Partial<CoachInput> | null;

    const intent = body?.intent;
    const course_id = body?.course_id;
    const lesson_id = body?.lesson_id;

    // Minimal validation (NO inventar contrato)
    if (!intent || !course_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Engine
    const out = runCoachLogic({
      intent,
      course_id,
      lesson_id,
      context: body?.context ?? null,
      user_input: body?.user_input ?? null
    } as CoachInput);

    return new Response(
      JSON.stringify(out),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("[coach-engine]", err);

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

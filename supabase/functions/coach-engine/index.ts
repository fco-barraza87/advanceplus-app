// index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runCoachLogic } from "./coach.logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  try {
    // =========================================================
    // Preflight
    // =========================================================
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =========================================================
    // Parse body
    // =========================================================
    const body = await req.json();

    // Validación mínima (7.0 existente)
    if (!body || !body.intent) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =========================================================
    // 🔐 Resolver usuario desde JWT (FUENTE DE VERDAD)
    // =========================================================
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") || "",
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // =========================================================
    // 🧠 Inyectar user_id en context (sin romper frontend)
    // =========================================================
    const enrichedBody = {
      ...body,
      context: {
        ...(body.context ?? {}),
        user_id: user?.id,
      },
    };

    // =========================================================
    // Ejecutar lógica del Coach
    // =========================================================
    const out = await runCoachLogic(enrichedBody);

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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

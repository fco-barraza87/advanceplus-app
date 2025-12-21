import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    /* ----------------------------
       CORS preflight
    ---------------------------- */
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    /* ----------------------------
       Only POST
    ---------------------------- */
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    /* ----------------------------
       Parse body
    ---------------------------- */
    const body = await req.json();

    const {
      intent,
      course_id,
      lesson_id,
      context,
      user_input,
    } = body ?? {};

    /* ----------------------------
       Minimal validation
    ---------------------------- */
    if (!intent || !course_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    /* ============================================================
       COACH LOGIC (MOCK · DETERMINISTIC)
    ============================================================ */
    let message = "Estoy aquí contigo.";

    /* ----------------------------
       Intent: lesson_observer
    ---------------------------- */
    if (intent === "lesson_observer") {
      const mood = context?.mindset?.mood ?? null;
      const reflection = context?.reflection?.content ?? "";

      if (mood !== null && mood <= 2) {
        message =
          "Hoy no fue fácil, y aun así estuviste aquí. Eso es disciplina real.";
      } else if (reflection.length > 40) {
        message =
          "Tu reflexión muestra intención. No busques perfección, busca continuidad.";
      } else {
        message =
          "Hoy hiciste lo más importante: no romper la cadena.";
      }
    }

    /* ----------------------------
       Intent: chat
    ---------------------------- */
    if (intent === "chat") {
      const text = (user_input || "").trim();
      const mood = context?.mindset?.mood ?? null;

      if (!text) {
        message =
          "Escríbeme lo que te pasa y lo vemos juntos.";
      } else if (mood !== null && mood <= 2) {
        message =
          "Antes de avanzar, dime: ¿qué fue lo más pesado hoy?";
      } else if (text.length < 20) {
        message =
          "Tómate un segundo más. ¿Qué es lo que realmente quieres resolver?";
      } else {
        message =
          "Gracias por decirlo así. Ahora vamos paso a paso.";
      }
    }

    /* ----------------------------
       Unknown intent (safe default)
    ---------------------------- */
    if (intent !== "lesson_observer" && intent !== "chat") {
      message = "Estoy aquí para acompañarte.";
    }

    /* ============================================================
       Response
    ============================================================ */
    return new Response(
      JSON.stringify({ message }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (err) {
    console.error("[coach-engine]", err);

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

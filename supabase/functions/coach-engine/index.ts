import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  try {
    // 🌐 CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 🔒 Solo POST
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

    // 🧠 Parse body
    const body = await req.json();

    const { intent, course_id, lesson_id, context } = body ?? {};

    // 🛑 Validación mínima
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

    // 🧠 Coach observador (mock determinista)
    let message = "Estoy aquí para acompañarte.";

    if (intent === "lesson_observer") {
      const mood = context?.mindset?.mood ?? null;
      const reflection = context?.reflection?.content ?? "";

      if (mood !== null && mood <= 2) {
        message =
          "Hoy no fue fácil, y aun así estuviste aquí. Eso es disciplina en acción.";
      } else if (reflection.length > 40) {
        message =
          "Tu reflexión muestra intención real. No busques perfección, busca continuidad.";
      } else {
        message =
          "Hoy hiciste lo más importante: no romper la cadena.";
      }
    }

    // 💬 Chat libre con el Coach (sin GPT aún)
    if (intent === "chat") {
      const text = (body?.user_input || "").trim();

      message = text
        ? "Te leo. Dime: ¿qué es lo más importante que quieres resolver ahora de esta lección?"
        : "Escríbeme lo que te pasa y te guío.";
    }


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

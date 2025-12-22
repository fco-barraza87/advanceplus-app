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
      const text = (body.user_input || "").trim().toLowerCase();

      // Helpers
      const len = text.length;
      const hasWords = (arr: string[]) =>
        arr.some(w => text.includes(w));

      // Estados
      const isVeryShort = len < 6;

      const isVague = hasWords([
        "todo",
        "la vida",
        "muchas cosas",
        "no sé",
        "nose",
        "confuso",
        "perdido"
      ]);

      const isEmotional = hasWords([
        "cansado",
        "agotado",
        "frustrado",
        "triste",
        "rabia",
        "enojo",
        "desmotivado",
        "ansioso",
        "estresado"
      ]);

      const isReflective = hasWords([
        "me doy cuenta",
        "entiendo",
        "veo que",
        "aprendí",
        "noté que"
      ]);

      const isActionOriented = hasWords([
        "quiero",
        "voy a",
        "decidí",
        "necesito",
        "haré"
      ]);

      // Respuesta por defecto
      let message =
        "Tómate un segundo. ¿Qué es lo que realmente quieres resolver hoy?";

      // ESTADO 1 — vacío / muy corto
      if (isVeryShort) {
        message =
          "Tómate un segundo. ¿Qué es lo que realmente quieres resolver hoy?";
      }

      // ESTADO 2 — vago / abstracto
      else if (isVague) {
        message =
          "De todo eso, ¿qué es lo que más te está drenando energía ahora mismo?";
      }

      // ESTADO 3 — emocional
      else if (isEmotional) {
        message =
          "Tiene sentido que te sientas así. ¿Qué acción pequeña sí está bajo tu control hoy?";
      }

      // ESTADO 4 — reflexivo
      else if (isReflective) {
        message =
          "Buena observación. ¿Qué decisión concreta se desprende de eso?";
      }

      // ESTADO 5 — orientado a acción
      else if (isActionOriented) {
        message =
          "Perfecto. ¿Cuándo y cómo vas a ejecutar eso?";
      }

      // Fallback consciente
      else {
        message =
          "Bien. Llevémoslo a algo concreto: ¿qué quieres cambiar a partir de hoy?";
      }

      return new Response(
        JSON.stringify({ message }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
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

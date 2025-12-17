import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    // 🔒 Solo POST
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 🧠 Body
    const body = await req.json();

    const {
      course_id,
      lesson_id,
      day,
      action_type,
      intent,
      user_input
    } = body || {};

    // 🛑 Validación mínima
    if (!course_id || !lesson_id || !action_type) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400 }
      );
    }

    // 🎭 RESPUESTAS MOCK SEGÚN CONTEXTO
    let blocks = [];

    if (action_type === "post_lesson") {
      blocks = [
        {
          type: "coach_message",
          text: "He leído tu cierre de hoy."
        },
        {
          type: "insight",
          title: "Observación",
          text:
            user_input
              ? "Lo que escribiste muestra conciencia, no perfección. Eso es disciplina real."
              : "Hoy avanzaste aunque no todo esté claro. Eso ya es progreso."
        },
        {
          type: "close",
          title: "Cierre del día",
          text: "No busques hacerlo mejor mañana. Solo vuelve."
        }
      ];
    }

    else if (action_type === "check_in") {
      blocks = [
        {
          type: "coach_message",
          text: "Gracias por ser honesto con tu proceso."
        },
        {
          type: "insight",
          title: "Lectura rápida",
          text: "La constancia no es cumplir siempre, es volver rápido."
        }
      ];
    }

    else {
      blocks = [
        {
          type: "coach_message",
          text: "Estoy aquí para acompañarte."
        }
      ];
    }

    // ✅ RESPUESTA FINAL
    return new Response(
      JSON.stringify({ blocks }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    console.error("[coach-engine mock error]", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500 }
    );
  }
});

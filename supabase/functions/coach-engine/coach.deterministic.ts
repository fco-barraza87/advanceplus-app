// coach.deterministic.ts
import type { CoachInput, CoachOutput } from "./coach.types.ts";
import { needsDerivation, getTurns, shouldClose } from "./guardrails.ts";

/* ============================================================
   Tone
============================================================ */
function applyTone(base: string, context: any): string {
  const tone = context?.lesson?.ai_meta?.coach_tone || "neutral";
  if (tone === "soft") return `Estoy contigo. ${base}`;
  if (tone === "firm") return `Vamos directo. ${base}`;
  return base;
}

/* ============================================================
   Motor determinista 6.x
============================================================ */
export function runCoachDeterministic(
  input: CoachInput
): CoachOutput {

  const { intent, context = {}, user_input = "" } = input;
  const text = user_input.trim().toLowerCase();

  /* ---------- lesson_observer ---------- */
  if (intent === "lesson_observer") {
    const mood = context?.mindset?.mood ?? null;
    const reflection = context?.reflection?.content ?? "";

    let msg = "Estoy aquí contigo.";

    if (mood !== null && Number(mood) <= 2) {
      msg = "Hoy no fue fácil, y aun así seguiste. Eso es disciplina real.";
    } else if (reflection.length > 40) {
      msg = "Tu reflexión muestra intención. Mantén la continuidad.";
    } else {
      msg = "Hoy hiciste lo más importante: no romper la cadena.";
    }

    return { message: applyTone(msg, context) };
  }

  /* ---------- chat ---------- */
  if (intent === "chat") {

    if (needsDerivation(text)) {
      return {
        message: applyTone(
          "Esto excede el espacio de este curso. Volvamos a una acción concreta para hoy.",
          context
        )
      };
    }

    if (shouldClose(getTurns(context))) {
      return {
        message: applyTone(
          "Cerramos aquí por hoy. Ejecuta una acción pequeña y mañana seguimos.",
          context
        )
      };
    }

    if (text.length < 6) {
      return {
        message: applyTone(
          "Respira un segundo. ¿Qué necesitas ahora mismo?",
          context
        )
      };
    }

    return {
      message: applyTone(
        "Llevémoslo a algo concreto. ¿Qué acción tomarás hoy?",
        context
      )
    };
  }

  return { message: "Estoy aquí para acompañarte." };
}

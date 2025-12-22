// coach.logic.ts
import type { CoachInput, CoachOutput } from "./coach.types.ts";
import { needsDerivation, getTurns, shouldClose } from "./guardrails.ts";

/* ============================================================
   Utils deterministas
============================================================ */

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function pickStable(arr: string[], seed: string): string {
  if (!arr.length) return "";
  const idx = hashSeed(seed) % arr.length;
  return arr[idx];
}

function hasAny(text: string, arr: string[]) {
  return arr.some(w => text.includes(w));
}

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
   Premium rules
============================================================ */

function wantsDepth(text: string) {
  return text.length > 140;
}

function isComplexButInScope(text: string) {
  const keys = [
    "hábito", "habitos", "disciplina", "procrast",
    "identidad", "rutina", "constancia",
    "foco", "enfoque", "ingresos", "dinero",
    "plan", "sistema"
  ];
  return keys.some(k => text.includes(k));
}

function shouldOfferPremium(text: string, context: any) {
  const repeat = context?.session?.repeat_issue === true;
  return wantsDepth(text) || isComplexButInScope(text) || repeat;
}

/* ============================================================
   MAIN ENGINE (6.x)
============================================================ */

export function runCoachLogic(input: CoachInput): CoachOutput {
  const { intent, context = {}, user_input = "" } = input;
  const text = user_input.trim().toLowerCase();
  const seed = `${intent}|${input.course_id}|${input.lesson_id}|${text}`.slice(0, 400);

  /* ----------------------------
     Lesson observer
  ---------------------------- */
  if (intent === "lesson_observer") {
    const mood = context?.mindset?.mood ?? null;
    const reflection = context?.reflection?.content ?? "";

    let base = "Estoy aquí contigo.";

    if (mood !== null && Number(mood) <= 2) {
      base = "Hoy no fue fácil, y aun así estuviste aquí. Eso es disciplina real.";
    } else if (String(reflection).length > 40) {
      base = "Tu reflexión muestra intención. No busques perfección, busca continuidad.";
    } else {
      base = "Hoy hiciste lo más importante: no romper la cadena.";
    }

    return { message: applyTone(base, context) };
  }

  /* ----------------------------
     Chat
  ---------------------------- */
  if (intent === "chat") {
    const turns = getTurns(context);

    if (needsDerivation(text)) {
      return {
        message: applyTone(
          "Esto que mencionas es importante, pero excede el espacio de este curso. Volvamos a una acción concreta que sí puedas hacer hoy.",
          context
        )
      };
    }

    if (shouldClose(turns)) {
      return {
        message: applyTone(
          "Tomemos esto como suficiente por hoy. Define una acción pequeña y ejecútala. Mañana seguimos.",
          context
        ),
        meta: { close_conversation: true }
      };
    }

    let base = "¿Qué es lo que realmente quieres resolver hoy?";

    if (text.length < 6) {
      base = "Respira un segundo. ¿Qué necesitas ahora mismo?";
    } else if (hasAny(text, ["todo", "vida", "confuso", "perdido"])) {
      base = pickStable([
        "Si eliges una sola cosa, ¿cuál sería?",
        "¿Qué te está drenando más energía hoy?",
        "¿Qué no puedes seguir postergando?"
      ], seed);
    } else if (hasAny(text, ["cansado", "frustrado", "ansioso"])) {
      base = pickStable([
        "Esa emoción tiene un mensaje. ¿Qué te está pidiendo cambiar?",
        "¿Qué acción mínima aliviaría esto hoy?"
      ], seed);
    } else if (hasAny(text, ["quiero", "voy a", "decidí"])) {
      base = pickStable([
        "Perfecto. Define cuándo y cómo lo harás.",
        "Hazlo simple. Hazlo hoy."
      ], seed);
    } else {
      base = "Llevémoslo a algo concreto. ¿Qué acción tomarás hoy?";
    }

    const finalMessage = applyTone(base, context);

    if (shouldOfferPremium(text, context)) {
      return {
        message:
          finalMessage +
          "\n\n💎 *Coach Pro*: si quieres, lo convertimos en un plan claro de 7 días con seguimiento.",
        meta: {
          premium_hint: true,
          premium_cta: "Desbloquear Coach Pro",
          premium_reason: wantsDepth(text) ? "deep_request" : "complex_topic"
        }
      };
    }

    return { message: finalMessage };
  }

  return { message: "Estoy aquí para acompañarte." };
}

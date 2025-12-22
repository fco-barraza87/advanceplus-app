import type { CoachInput, CoachOutput } from "./types.ts";
import { needsDerivation, getTurns, shouldClose } from "./guardrails.ts";

/* ============================================================
   Utils deterministas (no Math.random)
============================================================ */

function hashSeed(s: string): number {
  // hash simple y estable
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
   Tone (Capa 5.1)
============================================================ */

export function applyTone(base: string, context: any): string {
  const tone = context?.lesson?.ai_meta?.coach_tone || "neutral";

  if (tone === "soft") return `Estoy contigo. ${base}`;
  if (tone === "firm") return `Vamos directo. ${base}`;

  return base; // neutral
}

/* ============================================================
   Premium hint rules (P2)
============================================================ */

function wantsDepth(text: string) {
  return text.length > 140;
}

function isComplexButInScope(text: string) {
  const keys = [
    "hábito", "habitos", "disciplina", "procrast",
    "identidad", "rutina", "constancia",
    "foco", "enfoque", "móvil", "movil", "celular",
    "dopamina", "plan", "sistema"
  ];
  return keys.some(k => text.includes(k));
}

function shouldOfferPremium(text: string, context: any) {
  const repeat = context?.session?.repeat_issue === true; // futuro
  return wantsDepth(text) || isComplexButInScope(text) || repeat;
}

/* ============================================================
   Main Engine (B2)
============================================================ */

export function runCoachLogic(input: CoachInput): CoachOutput {
  const intent = input.intent;
  const context = input.context ?? {};
  const raw = (input.user_input ?? "");
  const text = raw.trim().toLowerCase();
  const seed = `${intent}|${input.course_id}|${input.lesson_id}|${text}`.slice(0, 500);

  /* ----------------------------
     Intent: lesson_observer
  ---------------------------- */
  if (intent === "lesson_observer") {
    const mood = context?.mindset?.mood ?? null;
    const reflection = context?.reflection?.content ?? "";

    let baseMessage = "Estoy aquí contigo.";

    if (mood !== null && Number(mood) <= 2) {
      baseMessage =
        "Hoy no fue fácil, y aun así estuviste aquí. Eso es disciplina real.";
    } else if (String(reflection).length > 40) {
      baseMessage =
        "Tu reflexión muestra intención. No busques perfección, busca continuidad.";
    } else {
      baseMessage =
        "Hoy hiciste lo más importante: no romper la cadena.";
    }

    return { message: applyTone(baseMessage, context) };
  }

  /* ----------------------------
     Intent: chat (Capa 5.1 + 6.3 + 6.4)
  ---------------------------- */
  if (intent === "chat") {
    const turns = getTurns(context);

    // Guardrail de scope / derivación
    if (needsDerivation(text)) {
      return {
        message: applyTone(
          "Esto que mencionas es importante, pero excede el espacio de este curso. Volvamos a una acción concreta que sí puedas hacer hoy.",
          context
        ),
        meta: { close_conversation: false }
      };
    }

    // Guardrail de cierre (futuro: turnos)
    if (shouldClose(turns)) {
      return {
        message: applyTone(
          "Tomemos esto como suficiente por hoy. Define una acción pequeña y ejecútala. Mañana seguimos.",
          context
        ),
        meta: { close_conversation: true }
      };
    }

    const len = text.length;

    const isVeryShort = len < 6;

    const isVague = hasAny(text, [
      "todo", "la vida", "muchas cosas", "no sé", "nose", "confuso", "perdido"
    ]);

    const isEmotional = hasAny(text, [
      "cansado", "agotado", "frustrado", "triste", "rabia", "enojo",
      "desmotivado", "ansioso", "estresado"
    ]);

    const isReflective = hasAny(text, [
      "me doy cuenta", "entiendo", "veo que", "aprendí", "aprendi", "noté", "note"
    ]);

    const isActionOriented = hasAny(text, [
      "quiero", "voy a", "decidí", "decidi", "necesito", "haré", "hare"
    ]);

    let baseMessage = "¿Qué es lo que realmente quieres resolver hoy?";

    if (isVeryShort) {
      baseMessage = "Respira un segundo. ¿Qué necesitas ahora mismo?";
    } else if (isVague) {
      baseMessage = pickStable([
        "Si eliges una sola cosa, ¿cuál sería?",
        "¿Qué te está drenando más energía hoy?",
        "¿Qué no puedes seguir postergando?"
      ], seed);
    } else if (isEmotional) {
      baseMessage = pickStable([
        "Esa emoción tiene un mensaje. ¿Qué te está pidiendo cambiar?",
        "No necesitas resolver todo. ¿Qué sí puedes hacer hoy?",
        "¿Qué acción mínima aliviaría esto?"
      ], seed);
    } else if (isReflective) {
      baseMessage = pickStable([
        "Bien visto. ¿Qué decisión concreta nace de eso?",
        "¿Qué harás distinto a partir de ahora?",
        "¿Cómo conviertes eso en acción?"
      ], seed);
    } else if (isActionOriented) {
      baseMessage = pickStable([
        "Perfecto. Define cuándo y cómo lo harás.",
        "Ese es el paso. Ejecútalo hoy.",
        "Hazlo simple y hazlo hoy."
      ], seed);
    } else {
      baseMessage = "Llevémoslo a algo concreto. ¿Qué acción tomarás hoy?";
    }

    const finalMessage = applyTone(baseMessage, context);

    // P2: CTA explícita dentro del mensaje + meta
    if (shouldOfferPremium(text, context)) {
      const reason =
        wantsDepth(text) ? "deep_request" :
        isComplexButInScope(text) ? "complex_topic" :
        "repeat_issue";

      return {
        message:
          finalMessage +
          "\n\n💎 **Coach Pro**: si quieres, te lo convierto en un plan claro de 7 días (pasos + checklist) y lo ajustamos a tu realidad.",
        meta: {
          premium_hint: true,
          premium_cta: "Desbloquear Coach Pro",
          premium_reason: reason
        }
      };
    }

    return { message: finalMessage };
  }

  /* ----------------------------
     Fallback seguro
  ---------------------------- */
  return { message: "Estoy aquí para acompañarte." };
}

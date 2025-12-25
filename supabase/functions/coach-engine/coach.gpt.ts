// coach.gpt.ts
import type {
  CoachInput,
  CoachOutput,
  CoachRuntimeContext,
} from "./coach.types.ts";

import { COACH_SYSTEM_PROMPT } from "./coach.prompt.ts";

/* ============================================================
   ENV
============================================================ */
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not configured (Edge Function secret)");
}

/* ============================================================
   Helpers
============================================================ */
function safeStr(v: unknown, max = 1200) {
  const s = (v ?? "").toString();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function buildUserPrompt(input: CoachInput): string {
  const { intent, context, user_input } = input;

  const lesson = context?.lesson ?? {};
  const ai = lesson?.ai_meta ?? {};
  const mindset = context?.mindset ?? {};
  const reflection = context?.reflection ?? {};

  if (intent === "lesson_observer") {
    return `
CONTEXTO LECCIÓN
- Día: ${safeStr(lesson?.day ?? "?", 50)}
- Título: ${safeStr(lesson?.title ?? "n/a", 140)}
- Tema: ${safeStr(ai?.day_theme ?? "n/a", 140)}
- Enfoque: ${safeStr(ai?.coach_focus ?? "n/a", 140)}
- Tono: ${safeStr(ai?.coach_tone ?? "neutral", 30)}

ESTADO USUARIO
- Mood (1-5): ${safeStr(mindset?.mood ?? "n/a", 20)}

REFLEXIÓN (si existe)
${safeStr(reflection?.content ?? "—", 1200)}

TAREA
Devuelve 1 mensaje breve de acompañamiento + 1 acción mínima ejecutable hoy (10–60s).
`;
  }

  if (intent === "chat") {
    return `
CONTEXTO LECCIÓN
- Día: ${safeStr(context?.lesson?.day ?? "?", 50)}
- Tono: ${safeStr(context?.lesson?.ai_meta?.coach_tone ?? "neutral", 30)}
- Enfoque: ${safeStr(context?.lesson?.ai_meta?.coach_focus ?? "n/a", 140)}

MENSAJE DEL USUARIO
"${safeStr(user_input ?? "", 800)}"

TAREA
Responde como Coach IA de Advance+. Sé breve, concreto y termina con:
- 1 pregunta concreta (una sola)
- 1 acción mínima para hoy
`;
  }

  return `Acompaña al usuario con claridad y enfoque.`;
}

function cleanMessage(s: string) {
  return s
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ============================================================
   GPT runner (fetch con timeout)
============================================================ */
export async function runCoachGPT(
  input: CoachInput,
  runtimeContext?: CoachRuntimeContext
): Promise<CoachOutput> {


  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000); // 12s

  try {
    const userPrompt = buildUserPrompt(input);

    // Log mínimo para saber si GPT está vivo (ver logs en Supabase)
    console.log("[coach.gpt] model=", OPENAI_MODEL, "intent=", input.intent);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.35,
        max_tokens: 220,
        messages: [
          { role: "system", content: COACH_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const messageRaw = data?.choices?.[0]?.message?.content ?? "";
    const message = cleanMessage(String(messageRaw));

    if (!message) throw new Error("Empty GPT response");

    return { text: message };

  } finally {
    clearTimeout(timeout);
  }
}

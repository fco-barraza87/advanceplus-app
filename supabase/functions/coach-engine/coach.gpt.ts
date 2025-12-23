// coach.gpt.ts
import type { CoachInput, CoachOutput } from "./coach.types.ts";
import { COACH_SYSTEM_PROMPT } from "./coach.prompt.ts";

/* ============================================================
   OpenAI client (fetch nativo)
============================================================ */

const OPENAI_API_KEY = Deno.env.get("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");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not configured");
}

/* ============================================================
   Helper · build user prompt
============================================================ */

function buildUserPrompt(input: CoachInput): string {
  const { intent, context, user_input } = input;

  if (intent === "lesson_observer") {
    return `
Lección actual:
- Día: ${context?.lesson?.day ?? "?"}
- Tema: ${context?.lesson?.ai_meta?.day_theme ?? "n/a"}
- Enfoque: ${context?.lesson?.ai_meta?.coach_focus ?? "n/a"}

Estado del usuario:
- Mood: ${context?.mindset?.mood ?? "n/a"}

Reflexión:
${context?.reflection?.content ?? "—"}

Devuelve un mensaje breve de acompañamiento.
`;
  }

  if (intent === "chat") {
    return `
Mensaje del usuario:
"${user_input}"

Responde como Coach IA de Advance+, siguiendo estrictamente el system prompt.
`;
  }

  return "Acompaña al usuario con claridad y enfoque.";
}

/* ============================================================
   Main GPT runner
============================================================ */

export async function runCoachGPT(
  input: CoachInput
): Promise<CoachOutput> {

  const userPrompt = buildUserPrompt(input);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4, // control > creatividad
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: COACH_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = await res.json();

  const message =
    data?.choices?.[0]?.message?.content?.trim();

  if (!message) {
    throw new Error("Empty GPT response");
  }

  return {
    message
  };
}

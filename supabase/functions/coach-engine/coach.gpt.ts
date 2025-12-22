// coach.gpt.ts
import { COACH_SYSTEM_PROMPT } from "./coach.prompt.ts";
import { CoachInput, CoachOutput } from "./coach.types.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function runCoachGPT(
  input: CoachInput
): Promise<CoachOutput> {

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const userMessage =
    input.intent === "lesson_observer"
      ? `Contexto de la lección:\n${JSON.stringify(input.context)}`
      : input.user_input || "";

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!res.ok) {
    throw new Error("GPT request failed");
  }

  const json = await res.json();
  const text =
    json.choices?.[0]?.message?.content?.trim();

  return {
    message: text || "Sigamos con una acción concreta hoy."
  };
}

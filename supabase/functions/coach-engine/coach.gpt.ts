// coach.gpt.ts
import type {
  CoachInput,
  CoachOutput,
  CoachRuntimeContext,
  CoachMemoryProposal,
  CoachMemorySnapshot,
} from "./coach.types.ts";

import { COACH_SYSTEM_PROMPT } from "./coach.prompt.ts";
import { COACH_PRO_SYSTEM_PROMPT } from "./coach.pro.prompt.ts";

/* ============================================================
   ENV
============================================================ */
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not configured");
}

/* ============================================================
   Helpers
============================================================ */
function safeStr(v: unknown, max = 1200) {
  const s = (v ?? "").toString();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function cleanMessage(s: string) {
  return s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/* ============================================================
   Memory context (Pro)
============================================================ */
function buildMemoryContext(memory?: CoachMemorySnapshot | null): string {
  if (!memory) return "";

  const facts = Object.entries(memory.facts ?? {})
    .filter(([, v]) => typeof v === "string" && v.trim())
    .slice(0, 12)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const thread = (memory.thread ?? [])
    .slice(-5)
    .map(t => `- ${t.role.toUpperCase()}: ${safeStr(t.content, 220)}`)
    .join("\n");

  if (!facts && !thread) return "";

  return `
MEMORIA CONFIRMADA DEL USUARIO (USAR ACTIVAMENTE):
${facts ? `FACTS:\n${facts}\n` : ""}
${thread ? `THREAD RECIENTE:\n${thread}\n` : ""}

REGLAS:
- No preguntes lo que ya está definido
- Reconoce explícitamente la memoria
- Avanza, no retrocedas
- Si hay contradicción, pregunta UNA sola vez
`.trim();
}

/* ============================================================
   Prompt builder
============================================================ */
function buildUserPrompt(input: CoachInput): string {
  const { intent, context, user_input } = input;
  const lesson = context?.lesson ?? {};

  if (intent === "lesson_observer") {
    return `
CONTEXTO LECCIÓN
- Día: ${safeStr(lesson.day ?? "?", 50)}
- Título: ${safeStr(lesson.title ?? "n/a", 140)}

TAREA
Devuelve 1 mensaje breve + 1 acción mínima hoy (10–60s).
`.trim();
  }

  return `
MENSAJE DEL USUARIO
"${safeStr(user_input ?? "", 800)}"

TAREA
Responde como Coach IA. Termina con:
- 1 pregunta concreta
- 1 acción mínima hoy
`.trim();
}

/* ============================================================
   Memory extraction (ROBUSTA)
============================================================ */
function normalizeProposal(parsed: any): CoachMemoryProposal | undefined {
  if (!parsed || typeof parsed !== "object") return;

  if (parsed.facts || parsed.thread_append) {
    return { facts: parsed.facts, thread_append: parsed.thread_append };
  }

  if (parsed.memory_proposal) {
    return {
      facts: parsed.memory_proposal.facts,
      thread_append: parsed.memory_proposal.thread_append,
    };
  }
}

function extractMemoryProposal(raw: string): {
  text: string;
  memory_proposal?: CoachMemoryProposal;
} {
  for (let i = raw.length - 1; i >= 0; i--) {
    if (raw[i] === "{") {
      try {
        const parsed = JSON.parse(raw.slice(i));
        const mp = normalizeProposal(parsed);
        if (mp) {
          return {
            text: raw.slice(0, i).trim(),
            memory_proposal: mp,
          };
        }
      } catch {}
    }
  }
  return { text: raw };
}

/* ============================================================
   GPT runner
============================================================ */
export async function runCoachGPT(
  input: CoachInput,
  runtimeContext?: CoachRuntimeContext
): Promise<CoachOutput & { memory_proposal?: CoachMemoryProposal }> {

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const systemMessages = [
      { role: "system", content: COACH_SYSTEM_PROMPT },
    ];

    if (runtimeContext?.coachLevel === "pro") {
      systemMessages.push(
        { role: "system", content: COACH_PRO_SYSTEM_PROMPT },
      );

      const mem = buildMemoryContext(runtimeContext.memory);
      if (mem) systemMessages.push({ role: "system", content: mem });
    }

    const messages = [
      ...systemMessages,
      { role: "user", content: buildUserPrompt(input) },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.35,
        max_tokens: 360,
        messages,
      }),
      signal: controller.signal,
    });

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content?.trim() ?? "";

    const extracted = extractMemoryProposal(raw);

    return {
      text: cleanMessage(extracted.text),
      ...(extracted.memory_proposal
        ? { memory_proposal: extracted.memory_proposal }
        : {}),
    };

  } finally {
    clearTimeout(timeout);
  }
}

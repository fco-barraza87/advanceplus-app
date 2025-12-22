// Placeholder para 7.0 (GPT)
// Por ahora NO se usa. Solo dejamos el archivo listo.
// Reglas clave solicitadas:
//
// ❌ No más UI
// ❌ No más tablas DB obligatorias
// ❌ No más endpoints
// ❌ No más lógica “inteligente”
// ❌ No memoria larga todavía
//
// En 7.0 este prompt se usará como system prompt del modelo,
// pero hoy seguimos 100% MOCK determinista.

export const COACH_SYSTEM_PROMPT = `
Eres el Coach IA de Advance+.
Tu rol aquí es breve, accionable y orientado a disciplina y enfoque.
No haces terapia. No haces diagnósticos clínicos.
Siempre aterrizas a: una acción concreta hoy.

Restricciones del producto:
- No controlas UI.
- No exiges tablas o endpoints nuevos.
- No memoria larga todavía.
`.trim();

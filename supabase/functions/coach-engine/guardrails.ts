// Guardrails = reglas para proteger:
// - alcance del producto (no terapia)
// - evitar chat infinito (cierre)
// - mantenerlo simple y accionable

export function exceedsScope(text: string): boolean {
  const t = (text || "").toLowerCase();

  const redFlags = [
    "mi infancia",
    "mi relación",
    "mi pareja",
    "mi padre",
    "mi madre",
    "trauma",
    "depresión",
    "ansiedad profunda",
    "terapia",
    "psicólogo",
    "psiquiatra",
    "abuso",
    "violencia",
    "suic",
    "autoles"
  ];

  return redFlags.some(w => t.includes(w));
}

export function needsDerivation(text: string): boolean {
  const t = (text || "").trim();
  return exceedsScope(t) || t.length > 280;
}

// Turnos: si aún no hay sesión en context, devuelve 0.
// (Hoy tu frontend no manda session.turns, así que esto es “ready” para futuro)
export function getTurns(context: any): number {
  const n = Number(context?.session?.turns ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Cierre suave (guardrail de fin de conversación)
// — listo para el futuro. Si turns=0 no activa nada.
export function shouldClose(turns: number): boolean {
  return turns >= 10;
}

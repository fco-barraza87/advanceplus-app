// guardrails.ts

export function needsDerivation(text: string): boolean {
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
    "psicólogo"
  ];
  return redFlags.some(w => text.includes(w));
}

// Por ahora: sin memoria real
export function getTurns(_context: any): number {
  return 1;
}

export function shouldClose(turns: number): boolean {
  return turns >= 5;
}

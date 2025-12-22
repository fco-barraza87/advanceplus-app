// Placeholder para 7.0.
// No se usa todavía. En 7.0 aquí irá la llamada real a OpenAI (o proveedor que definas).

export type GptRequest = {
  system: string;
  user: string;
  temperature?: number;
};

export async function callGpt(_req: GptRequest): Promise<string> {
  // NO IMPLEMENTAR AÚN
  return "GPT not configured";
}

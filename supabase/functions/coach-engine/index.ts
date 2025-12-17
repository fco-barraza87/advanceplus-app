import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();

  return new Response(
    JSON.stringify({
      blocks: [
        {
          type: "text",
          title: "Coach IA",
          text: "Estoy activo. La función coach-engine responde correctamente."
        }
      ]
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});


import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("https://lmlfvbzukymtkcyfromr.supabase.co")!,
      Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbGZ2Ynp1a3ltdGtjeWZyb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjA3MzksImV4cCI6MjA3ODUzNjczOX0.VtetQ9jdaG6ZIDNGKsaTqxllET0nBZBrYDmZgfEdpLU")!
    );

    const authHeader = req.headers.get("Authorization")!;
    const { data: { user } } = await supabase.auth.getUser(authHeader);

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { course_id, lesson_id, day, action_type, intent, user_input } = body;

    const allowedActions = ["post_lesson"];
    if (!allowedActions.includes(action_type)) {
      return new Response("Invalid action", { status: 400 });
    }

    const { data: allowed } = await supabase.rpc("has_active_coach", {
      p_user: user.id,
      p_course: course_id
    });

    if (!allowed) {
      return new Response("No entitlement", { status: 403 });
    }

    const { data: systemPrompt } = await supabase
      .from("ai_prompts")
      .select("prompt")
      .eq("key", "coach_system")
      .eq("active", true)
      .maybeSingle();

    const { data: taskPrompt } = await supabase
      .from("ai_prompts")
      .select("prompt")
      .eq("key", "coach_post_lesson_card")
      .eq("active", true)
      .maybeSingle();

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt.prompt },
          {
            role: "user",
            content: taskPrompt.prompt
              .replace("{{user_input}}", user_input || "")
          }
        ]
      })
    });

    const result = await completion.json();
    const text = result.choices[0].message.content;

    return new Response(
      JSON.stringify({
        blocks: [
          { type: "message", text },
          { type: "close", title: "Cierre", text: "Mañana continuamos." }
        ]
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { CoachMemorySnapshot } from "./coach.types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function upsertMemory(
  userId: string,
  memory: CoachMemorySnapshot
) {
  try {
    await supabase.from("user_coach_memory").upsert({
      user_id: userId,
      facts: memory.facts,
      thread: memory.thread,
      version: memory.version,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[coach.memory.persist]", e);
  }
}

export async function loadMemory(
  userId: string
): Promise<CoachMemorySnapshot | null> {
  try {
    const { data } = await supabase
      .from("user_coach_memory")
      .select("*")
      .eq("user_id", userId)
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

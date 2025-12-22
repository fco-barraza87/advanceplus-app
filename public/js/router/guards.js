import { supabase } from "/js/supabase.js";

export async function getSessionContext() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    role: profile.role
  };
}

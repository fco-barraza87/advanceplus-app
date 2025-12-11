import { supabase } from "/js/supabase.js";

export async function requireAdmin() {
  console.log("[admin] Checking admin access...");

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    console.warn("[admin] User is not admin");
    window.location.href = "/dashboard/index.html";
    return;
  }

  console.log("[admin] Access granted");
  return true;
}

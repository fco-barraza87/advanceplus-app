import { supabase } from "/js/supabase.js";
import { protectUserView } from "/js/router.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectUserView();

  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const el = (id) => document.getElementById(id);
  if (!el("p_nombre")) return;

  el("p_nombre").textContent = profile?.fullname ?? "(Sin nombre)";
  el("p_email").textContent = user.email;
  el("p_role").textContent = profile?.role ?? "Usuario";
  el("p_country").textContent = profile?.country ?? "—";
  el("p_created").textContent = new Date(profile?.created_at).toLocaleDateString();
});

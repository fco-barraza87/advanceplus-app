// Conexión con Supabase
const SUPABASE_URL = 
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : "https://gwemdxauzhfwwktqbxcm.supabase.co";

const SUPABASE_KEY = 
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : "sb_publishable_1quYmvn_zmzxGGaIfBSttA_MYs8QFQ1";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Obtener sesión actual
async function loadUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    alert("⚠️ No hay sesión activa. Por favor inicia sesión nuevamente.");
    window.location.href = "/";
    return;
  }

  const user = data.user;

  // Mostrar información básica
  document.getElementById("user-name").textContent = "Bienvenido, " + (user.user_metadata?.name || "Usuario");
  document.getElementById("user-email").textContent = user.email;

  // Buscar progreso del usuario (XP, cursos, etc.)
  const { data: progress } = await supabase
    .from("progress")
    .select("xp")
    .eq("user_id", user.id)
    .single();

  document.getElementById("user-xp").textContent = progress?.xp || 0;
}

// Cerrar sesión
document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  alert("👋 Sesión cerrada correctamente");
  window.location.href = "/";
});

// Ejecutar
loadUser();

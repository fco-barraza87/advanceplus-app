// admin.js
const supabaseUrl = "https://TU_URL_SUPABASE.supabase.co";
const supabaseKey = "TU_API_KEY_PUBLICA";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function initAdmin() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("No hay sesión activa. Por favor inicia sesión nuevamente.");
    window.location.href = "../index.html";
    return;
  }

  // ⚡ Verificar rol admin o coach
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userData || (userData.role !== "admin" && userData.role !== "coach")) {
    alert("Acceso restringido. No tienes permisos para ver este panel.");
    window.location.href = "../dashboard/";
    return;
  }

  document.getElementById("logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "../index.html";
  });

  loadMetrics();
  loadActivity();
}

async function loadMetrics() {
  try {
    // Usuarios
    const { data: users } = await supabase.from("users").select("id");
    document.getElementById("total-users").textContent = users?.length || 0;

    // Cursos activos
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("active", true);
    document.getElementById("total-courses").textContent = courses?.length || 0;

    // XP promedio
    const { data: progress } = await supabase.from("progress").select("xp, streak");
    const totalXp = progress?.reduce((sum, p) => sum + (p.xp || 0), 0) || 0;
    const avgXp = progress?.length ? Math.round(totalXp / progress.length) : 0;
    document.getElementById("avg-xp").textContent = avgXp;

    // Streak promedio
    const totalStreak = progress?.reduce((s, p) => s + (p.streak || 0), 0) || 0;
    const avgStreak = progress?.length ? Math.round(totalStreak / progress.length) : 0;
    document.getElementById("avg-streak").textContent = avgStreak;
  } catch (err) {
    console.error("Error al cargar métricas:", err);
  }
}

async function loadActivity() {
  const { data: recent } = await supabase
    .from("progress")
    .select("updated_at, xp, course_id, user_id")
    .order("updated_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("recent-activity");
  list.innerHTML = "";

  recent?.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `Usuario ${item.user_id.slice(0, 6)} ganó ${item.xp} XP — ${new Date(item.updated_at).toLocaleString()}`;
    list.appendChild(li);
  });
}

initAdmin();

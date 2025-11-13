import { supabase } from "../js/supabase.js";

(async () => {

  /* --- AUTENTICACIÓN --- */
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.href = "/index.html";

  /* --- PERFIL DEL USUARIO --- */
  const { data: userData } = await supabase
    .from("users")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  document.getElementById("userName").textContent = userData?.full_name ?? "Usuario";
  if (userData?.avatar_url) {
    document.getElementById("userAvatar").src = userData.avatar_url;
  }

  /* --- GAMIFICACIÓN --- */
  const { data: gamification } = await supabase
    .from("gamification")
    .select("xp_total, level, streak_current, xp_threshold")
    .eq("user_id", user.id)
    .single();

  if (gamification) {
    document.getElementById("xpTotal").textContent = `${gamification.xp_total} XP`;
    document.getElementById("userLevel").textContent = `Lv ${gamification.level}`;
    document.getElementById("streakText").textContent = `🔥 Racha: ${gamification.streak_current} días`;

    const pct = Math.min(
      (gamification.xp_total / gamification.xp_threshold) * 100,
      100
    );
    document.getElementById("xpBar").style.width = `${pct}%`;
  }

  /* --- CURSOS DEL USUARIO --- */
  const { data: cursos, error } = await supabase.rpc("get_user_courses", {
    uid: user.id,
  });

  if (error) {
    console.error("Error cargando cursos:", error);
  }

  const grid = document.getElementById("coursesGrid");
  grid.innerHTML = "";

  cursos?.forEach(course => {
    const card = document.createElement("div");
    card.className = "course-card";
    card.onclick = () => window.location.href = `/curso/index.html?c=${course.slug}`;

    card.innerHTML = `
      <img src="${course.cover_url}" class="course-cover"/>
      <div class="course-info">
        <p class="course-title">${course.title}</p>

        <div class="course-progress">
          <div class="course-progress-bar" style="width:${course.progress_pct}%"></div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

})();

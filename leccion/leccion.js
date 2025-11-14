// /leccion/leccion.js
import { supabase } from "/js/supabase.js";

async function cargarLeccion() {
  const params = new URLSearchParams(window.location.search);
  const lid = params.get("lid");
  if (!lid) return;

  // 1. Usuario
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.href = "/index.html";

  // 2. Obtener contenido
  const { data: leccion } = await supabase
    .from("lessons")
    .select("id, title, content_html, course_id, order_index")
    .eq("id", lid)
    .single();

  document.getElementById("leccionTitulo").textContent = leccion.title;
  document.getElementById("leccionContenido").innerHTML = leccion.content_html;

  // 3. Botón completar
  document.getElementById("btnCompletar").onclick = async () => {
    await supabase
      .from("progress")
      .insert({ user_id: user.id, lesson_id: leccion.id, completed: true })
      .catch(() => {});

    // 4. Cargar siguiente
    const { data: siguiente } = await supabase
      .from("lessons")
      .select("id, order_index")
      .eq("course_id", leccion.course_id)
      .gt("order_index", leccion.order_index)
      .order("order_index", { ascending: true })
      .limit(1);

    if (siguiente?.length) {
      window.location.href = `/leccion/index.html?lid=${siguiente[0].id}`;
    } else {
      window.location.href = "/dashboard/index.html";
    }
  };
}

cargarLeccion();
// /curso/curso.js
import { supabase } from "/js/supabase.js";

async function cargarCurso() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("c");
  if (!slug) return;

  // 1. Obtener usuario
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.href = "/index.html";

  // 2. Obtener datos del curso
  const { data: curso } = await supabase
    .from("courses")
    .select("id, title, subtitle, cover_url, description")
    .eq("slug", slug)
    .single();

  if (!curso) return;

  document.getElementById("cursoPortada").innerHTML = `<img src="${curso.cover_url}" class="curso-img">`;
  document.getElementById("cursoTitulo").textContent = curso.title;
  document.getElementById("cursoSubtitulo").textContent = curso.subtitle;

  // 3. Obtener lecciones
  const { data: lecciones } = await supabase
    .from("lessons")
    .select("id, title, order_index")
    .eq("course_id", curso.id)
    .order("order_index", { ascending: true });

  const lista = document.getElementById("listaLecciones");
  lista.innerHTML = "";

  lecciones.forEach((lec) => {
    const item = document.createElement("div");
    item.className = "leccion-item";
    item.innerHTML = `
      <div class="leccion-title">${lec.order_index}. ${lec.title}</div>
    `;
    item.onclick = () => {
      window.location.href = `/leccion/index.html?lid=${lec.id}`;
    };
    lista.appendChild(item);
  });
}

cargarCurso();



import { supabase } from "/js/supabase.js";


// Navegación entre pasos
overrideNext = (step) => window.location.href = `/onboarding/step${step}.html`;
export function nextStep(step) {
window.location.href = `/onboarding/step${step}.html`;
}


// Guardar objetivo\export async function saveGoal(goal) {
const { data: { user } } = await supabase.auth.getUser();
await supabase.from("users").update({ goal }).eq("id", user.id);
nextStep(3);
}


// Guardar tiempo diario\export async function saveTime(minutes) {
const { data: { user } } = await supabase.auth.getUser();
await supabase.from("users").update({ daily_minutes: minutes }).eq("id", user.id);
nextStep(4);
}


// Generar plan (simulado)
if (window.location.pathname.includes("step4")) {
setTimeout(() => {
window.location.href = "/onboarding/finish.html";
}, 2000);
}


// Finalizar onboarding\export async function goToFirstLesson() {
const { data: { user } } = await supabase.auth.getUser();


// Marcar onboarding como terminado
await supabase
.from("users")
.update({ onboarding_completed: true })
.eq("id", user.id);


// Asignar curso inicial
await supabase
.from("user_courses")
.insert([{ user_id: user.id, course_id: "curso-bienvenida" }]);


window.location.href = "/curso/index.html?c=curso-bienvenida";
}
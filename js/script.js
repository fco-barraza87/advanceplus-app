

// Inicializa conexión con Supabase
const SUPABASE_URL = 
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : "https://gwemdxauzhfwwktqbxcm.supabase.co"; // opcional para pruebas locales

const SUPABASE_KEY = 
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : "sb_publishable_1quYmvn_zmzxGGaIfBSttA_MYs8QFQ1"; // opcional para pruebas locales

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Función de login
document.getElementById("btn-login").addEventListener("click", async () => {
  const email = prompt("Ingresa tu correo:");
  const password = prompt("Ingresa tu contraseña:");

  if (!email || !password) {
    alert("Por favor ingresa ambos campos.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("❌ Error al iniciar sesión: " + error.message);
  } else {
    alert("✅ Sesión iniciada con éxito, bienvenido " + email);
    window.location.href = "/dashboard.html"; // redirección
  }
});

// Función de registro
document.getElementById("btn-register").addEventListener("click", async () => {
  const email = prompt("Ingresa tu correo para registrarte:");
  const password = prompt("Crea una contraseña:");

  if (!email || !password) {
    alert("Por favor ingresa ambos campos.");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert("❌ Error al crear cuenta: " + error.message);
  } else {
    alert("✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.");
  }
});


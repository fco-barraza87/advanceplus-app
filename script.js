// Conexión segura a Supabase (usa variables del entorno de Vercel)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Si ejecutas localmente, usa fallback (útil para pruebas fuera de Vercel)
const supabase = window.supabase.createClient(
  SUPABASE_URL || 'https://gwemdxauzhfwwktqbxcm.supabase.co',
  SUPABASE_KEY || 'sb_publishable_1quYmvn_zmzxGGaIfBSttA_MYs8QFQ1'
);


document.getElementById('btn-login').addEventListener('click', async () => {
  const email = prompt('Ingresa tu correo:');
  const password = prompt('Ingresa tu contraseña:');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert('❌ Error al iniciar sesión: ' + error.message);
  } else {
    alert('✅ Sesión iniciada con éxito, bienvenido ' + email);
    window.location.href = '/dashboard.html'; // puedes cambiar la ruta
  }
});

document.getElementById('btn-register').addEventListener('click', async () => {
  const email = prompt('Ingresa tu correo para registrarte:');
  const password = prompt('Crea una contraseña:');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert('❌ Error al crear cuenta: ' + error.message);
  } else {
    alert('✅ Registro exitoso, revisa tu email para confirmar tu cuenta.');
  }
});

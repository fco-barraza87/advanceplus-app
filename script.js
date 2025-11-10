// Conexión segura a Supabase (usa variables del entorno de Vercel)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Si ejecutas localmente, usa fallback (útil para pruebas fuera de Vercel)
const supabase = window.supabase.createClient(
  SUPABASE_URL || 'https://gwemdxauzhfwwktqbxcm.supabase.co',
  SUPABASE_KEY || 'sb_publishable_1quYmvn_zmzxGGaIfBSttA_MYs8QFQ1'
);


document.getElementById('login-btn').addEventListener('click', () => {
  alert('Aquí irá la conexión con Supabase Auth.');
});

document.getElementById('register-btn').addEventListener('click', () => {
  alert('Aquí se conectará el registro de usuario.');
});

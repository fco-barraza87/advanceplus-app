

/* -----------------------------------------------------
   VARIABLES DEL PROYECTO SUPABASE
   ⚠️ Rellena con tus valores reales
----------------------------------------------------- */

const SUPABASE_URL = "https://lmlfvbzukymtkcyfromr.supabase.co";   // <-- aquí tu URL real
const SUPABASE_ANON_KEY = "sb_publishable_hmEwUbwWxBFEKl73hIcO8w_zWEFw2TW";                // <-- aquí tu anon key

/* -----------------------------------------------------
   CLIENTE SUPABASE
   - Persistencia local
   - Auto-refresh de tokens
----------------------------------------------------- */

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,         // Mantiene sesión incluso si se recarga la página
    autoRefreshToken: true,       // Renueva tokens automáticamente
    detectSessionInUrl: true      // Captura tokens en redirecciones OAuth
  }
});

/* -----------------------------------------------------
   LISTENER GLOBAL DE SESIÓN
----------------------------------------------------- */

supabase.auth.onAuthStateChange((event, session) => {
  console.log("🔐 Auth event:", event);

  if (event === "SIGNED_IN") {
    console.log("Usuario inició sesión:", session?.user?.email);
  }

  if (event === "SIGNED_OUT") {
    console.log("Usuario desconectado.");
  }

  if (event === "TOKEN_REFRESHED") {
    console.log("🔄 Token refrescado automáticamente");
  }

  if (event === "PASSWORD_RECOVERY") {
    console.log("🔧 Recuperación de contraseña iniciada");
  }
});

/* -----------------------------------------------------
   LIBRERÍA DE FUNCIONES ÚTILES (helpers)
----------------------------------------------------- */

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function isLogged() {
  const session = await getSession();
  return !!session;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
}

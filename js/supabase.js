/* -----------------------------------------------------
   VARIABLES DEL PROYECTO SUPABASE
----------------------------------------------------- */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://lmlfvbzukymtkcyfromr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbGZ2Ynp1a3ltdGtjeWZyb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjA3MzksImV4cCI6MjA3ODUzNjczOX0.VtetQ9jdaG6ZIDNGKsaTqxllET0nBZBrYDmZgfEdpLU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// ⭐⭐ ESTA LÍNEA FALTABA ⭐⭐
window.supabase = supabase2;

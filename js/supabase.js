/* -----------------------------------------------------
   VARIABLES DEL PROYECTO SUPABASE
----------------------------------------------------- */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://lmlfvbzukymtkcyfromr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hmEwUbwWxBFEKl73hIcO8w_zWEFw2TW";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// ⭐⭐ ESTA LÍNEA FALTABA ⭐⭐
window.supabase = supabase;

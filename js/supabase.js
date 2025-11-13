// /js/supabase.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://lmlfvbzukymtkcyfromr.supabase.co";   // <-- aquí tu URL real
const SUPABASE_ANON_KEY = "sb_publishable_hmEwUbwWxBFEKl73hIcO8w_zWEFw2TW";                // <-- aquí tu anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

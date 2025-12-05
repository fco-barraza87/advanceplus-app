

// /js/supabase.js

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://lmflvbzukymtkcyfromr.supabase.co";
const SUPABASE_ANON_KEY = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbGZ2Ynp1a3ltdGtjeWZyb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjA3MzksImV4cCI6MjA3ODUzNjczOX0"; // el mismo que ya usabas

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// opcional pero útil: acceso global en la consola
window.supabase = supabase;

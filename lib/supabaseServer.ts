import { supabaseServer } from "../../../../lib/supabaseServer";

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ שרת בלבד
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // באדמין/API אנחנו רוצים לעקוף RLS => service role
  const keyToUse = serviceKey || anonKey;

  return createClient(url, keyToUse, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const supabase = supabasePublic();
  const { data, error } = await supabase.from("site_settings").select("key,value").eq("key", "site").single();

  if (error) return NextResponse.json({ ui: null, require_approval: true }, { status: 200 });

  const require_approval = data?.value?.require_approval ?? true;
  const ui = data?.value?.ui ?? null;

  return NextResponse.json({ require_approval, ui }, { status: 200 });
}

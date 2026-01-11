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

  if (error) return NextResponse.json({ ui: null, require_approval: true, hero_image_url: null, hero_link_url: null }, { status: 200 });

  const require_approval = data?.value?.require_approval ?? true;
  const ui = data?.value?.ui ?? null;
  const hero_image_url = typeof data?.value?.hero_image_url === "string" ? data.value.hero_image_url : null;
  const hero_link_url = typeof data?.value?.hero_link_url === "string" ? data.value.hero_link_url : null;

  return NextResponse.json({ require_approval, ui, hero_image_url, hero_link_url }, { status: 200 });
}

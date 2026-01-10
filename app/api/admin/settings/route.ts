// app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

function mustBeServiceRole() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "חסר SUPABASE_SERVICE_ROLE_KEY ב-Vercel (חובה לאדמין)";
  }
  return null;
}

export async function GET() {
  const missing = mustBeServiceRole();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("site_settings").select("key,value").eq("key", "site").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ value: data?.value || {} }, { status: 200 });
}

// PUT { value: {...} }
export async function PUT(req: Request) {
  const missing = mustBeServiceRole();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);
  const value = body?.value;

  if (!value || typeof value !== "object") {
    return NextResponse.json({ error: "חסר value (object)" }, { status: 400 });
  }

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "site", value }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

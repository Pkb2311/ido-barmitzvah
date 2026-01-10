import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "ui_settings").single();

  if (error) {
    // אם אין עדיין - נחזיר null כדי שהניהול יוכל להציג ברירת מחדל
    return NextResponse.json({ ok: true, ui: null }, { status: 200 });
  }

  return NextResponse.json({ ok: true, ui: data?.value || null }, { status: 200 });
}

export async function PATCH(req: Request) {
  const supabase = supabaseServer();

  const body = await req.json().catch(() => null);
  const ui = body?.ui;

  if (!ui || typeof ui !== "object") {
    return NextResponse.json({ error: "Missing ui" }, { status: 400 });
  }

  const { error } = await supabase.from("site_settings").upsert({ key: "ui_settings", value: ui });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}


import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

function requireAdmin(req: Request) {
  const pass = process.env.ADMIN_PASSWORD || "";
  const got = req.headers.get("x-admin-password") || "";
  return pass && got && pass === got;
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .eq("key", "upload_settings")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, value: data?.value ?? {} }, { status: 200 });
}

export async function PUT(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const value = body?.value ?? null;

  if (!value || typeof value !== "object") {
    return NextResponse.json({ error: "value must be an object" }, { status: 400 });
  }

  const supabase = supabaseServer();

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "upload_settings", value }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

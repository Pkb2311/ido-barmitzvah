import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const next = {
    max_video_mb: Number(body.max_video_mb ?? 50),
    max_image_mb: Number(body.max_image_mb ?? 10),
    image_max_width: Number(body.image_max_width ?? 1600),
    image_quality: Number(body.image_quality ?? 0.82),
    per_page: Number(body.per_page ?? 20),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert([{ key: "upload_settings", value: next }], { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, value: next });
}

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "upload_settings")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const value = data?.value ?? {
    max_video_mb: 50,
    max_image_mb: 10,
    image_max_width: 1600,
    image_quality: 0.82,
    per_page: 20,
  };

  return NextResponse.json({ value });
}


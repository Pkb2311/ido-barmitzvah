import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  // בגלל שיש לך Basic Auth במידלוור על /admin,
  // הבקשה הזו תעבור רק אם המשתמש נכנס לאדמין.
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

  // ולידציה בסיסית
  if (next.max_video_mb < 5 || next.max_video_mb > 500) return NextResponse.json({ error: "max_video_mb out of range" }, { status: 400 });
  if (next.image_quality < 0.4 || next.image_quality > 0.95) return NextResponse.json({ error: "image_quality out of range" }, { status: 400 });
  if (next.image_max_width < 800 || next.image_max_width > 4000) return NextResponse.json({ error: "image_max_width out of range" }, { status: 400 });

  const { error } = await supabase
    .from("site_settings")
    .upsert([{ key: "upload_settings", value: next }], { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, value: next });
}


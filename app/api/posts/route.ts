import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function getUploadSettings() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "upload_settings")
    .maybeSingle();

  return (
    data?.value ?? {
      max_video_mb: 50,
      max_image_mb: 10,
      image_max_width: 1600,
      image_quality: 0.82,
      per_page: 20,
    }
  );
}

export async function GET() {
  const supabase = supabaseServer();
  const s = await getUploadSettings();

  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at, name, message, media_url, media_type, link_url")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(Number(s.per_page ?? 20));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, per_page: s.per_page ?? 20 });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const s = await getUploadSettings();

  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  const message = String(form.get("message") || "").trim();
  const link_url = String(form.get("link_url") || "").trim();
  const file = form.get("media") as File | null;

  if (!name || !message) {
    return NextResponse.json({ error: "חובה למלא שם וברכה" }, { status: 400 });
  }

  // אם יש לינק — ולידציה בסיסית (לא חוסמים אגרסיבי)
  if (link_url && !/^https?:\/\//i.test(link_url)) {
    return NextResponse.json({ error: "הלינק חייב להתחיל ב-http/https" }, { status: 400 });
  }

  let media_url: string | null = null;
  let media_type: string | null = null;

  if (file && file.size > 0) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "קובץ לא נתמך. העלה תמונה או סרטון." }, { status: 400 });
    }

    const maxImageBytes = Number(s.max_image_mb ?? 10) * 1024 * 1024;
    const maxVideoBytes = Number(s.max_video_mb ?? 50) * 1024 * 1024;

    if (isImage && file.size > maxImageBytes) {
      return NextResponse.json({ error: `תמונה גדולה מדי. מקסימום ${s.max_image_mb}MB` }, { status: 400 });
    }
    if (isVideo && file.size > maxVideoBytes) {
      return NextResponse.json({ error: `סרטון גדול מדי. מקסימום ${s.max_video_mb}MB` }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "webp")).toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("uploads")
      .upload(filename, buf, { contentType: file.type, upsert: false });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: pub } = supabase.storage.from("uploads").getPublicUrl(filename);
    media_url = pub.publicUrl;
    media_type = isVideo ? "video" : "image";
  }

  const { error: insErr } = await supabase.from("posts").insert({
    name,
    message,
    link_url: link_url || null,
    media_url,
    media_type,
    approved: true, // שבוע ראשון פתוח
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}



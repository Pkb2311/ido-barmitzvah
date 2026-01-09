import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

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

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const s = await getUploadSettings();

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // "pending" | "approved" | null

  const approvedFilter =
    status === "pending" ? false : status === "approved" ? true : null;

  let q = supabase
    .from("posts")
    .select("id, created_at, name, message, media_url, media_type, link_url, approved")
    .order("created_at", { ascending: false })
    .limit(Number(s.per_page ?? 20));

  if (approvedFilter !== null) q = q.eq("approved", approvedFilter);

  const { data, error } = await q;
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

  if (link_url && !/^https?:\/\//i.test(link_url)) {
    return NextResponse.json(
      { error: "הלינק חייב להתחיל ב-http/https" },
      { status: 400 }
    );
  }

  let media_url: string | null = null;
  let media_type: string | null = null;

  if (file && file.size > 0) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "קובץ לא נתמך. העלה תמונה או סרטון." },
        { status: 400 }
      );
    }

    const maxImageBytes = Number(s.max_image_mb ?? 10) * 1024 * 1024;
    const maxVideoBytes = Number(s.max_video_mb ?? 50) * 1024 * 1024;

    if (isImage && file.size > maxImageBytes) {
      return NextResponse.json(
        { error: `תמונה גדולה מדי. מקסימום ${s.max_image_mb}MB` },
        { status: 400 }
      );
    }
    if (isVideo && file.size > maxVideoBytes) {
      return NextResponse.json(
        { error: `סרטון גדול מדי. מקסימום ${s.max_video_mb}MB` },
        { status: 400 }
      );
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
    approved: true, // כרגע פתוח
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// ✅ זה מה שחסר לך: שינוי אישור (בטל/אשר)
export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const approved = Boolean(body.approved);

  const { error } = await supabase
    .from("posts")
    .update({ approved })
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// ✅ זה מה שחסר לך: מחיקה
export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // אופציונלי: להביא את ה-media_url כדי למחוק גם מה-Storage
  const { data: row, error: readErr } = await supabase
    .from("posts")
    .select("media_url")
    .eq("id", body.id)
    .maybeSingle();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const { error: delErr } = await supabase.from("posts").delete().eq("id", body.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // אם זו תמונה/וידאו מה-bucket uploads, ננסה למחוק את הקובץ
  // (רק אם URL הוא של supabase storage ומכיל את שם הקובץ)
  const mediaUrl = row?.media_url || "";
  const marker = "/storage/v1/object/public/uploads/";
  if (mediaUrl.includes(marker)) {
    const filename = mediaUrl.split(marker)[1]?.split("?")[0];
    if (filename) {
      await supabase.storage.from("uploads").remove([filename]).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}

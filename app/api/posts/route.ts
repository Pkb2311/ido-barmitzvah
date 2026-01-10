import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const EDIT_WINDOW_MS = 60 * 60 * 1000; // שעה

function getOwnerToken(req: Request) {
  return req.headers.get("x-owner-token") || "";
}

function addHourIso() {
  return new Date(Date.now() + EDIT_WINDOW_MS).toISOString();
}

/* =========================
   GET – ברכות מאושרות
========================= */
export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, created_at, name, message, media_url, media_type, link_url, editable_until"
    )
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

/* =========================
   POST – יצירת ברכה
========================= */
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const ownerToken = getOwnerToken(req);

  if (!ownerToken) {
    return NextResponse.json({ error: "חסר owner token" }, { status: 400 });
  }

  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  const message = String(form.get("message") || "").trim();
  const link_url = String(form.get("link_url") || "").trim() || null;

  if (!name || !message) {
    return NextResponse.json({ error: "שם וברכה חובה" }, { status: 400 });
  }

  let media_url: string | null = null;
  let media_type: "image" | "video" | null = null;

  const media = form.get("media");
  if (media instanceof File && media.size > 0) {
    const isImage = media.type.startsWith("image/");
    const isVideo = media.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "קובץ לא נתמך" }, { status: 400 });
    }

    media_type = isImage ? "image" : "video";
    const ext = media.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("uploads")
      .upload(fileName, media, {
        contentType: media.type,
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    media_url = supabase.storage.from("uploads").getPublicUrl(fileName).data
      .publicUrl;
  }

  const { error } = await supabase.from("posts").insert({
    name,
    message,
    link_url,
    media_url,
    media_type,
    approved: true, // או false אם אתה רוצה אישור מנהל
    owner_token: ownerToken,
    editable_until: addHourIso(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

/* =========================
   PATCH – עריכה + החלפת מדיה
========================= */
export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const ownerToken = getOwnerToken(req);
  if (!ownerToken) {
    return NextResponse.json({ error: "חסר owner token" }, { status: 400 });
  }

  const form = await req.formData();
  const id = String(form.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "חסר id" }, { status: 400 });
  }

  const { data: post, error: getErr } = await supabase
    .from("posts")
    .select("owner_token, editable_until, media_url")
    .eq("id", id)
    .single();

  if (getErr || !post) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  if (
    post.owner_token !== ownerToken ||
    Date.now() > new Date(post.editable_until).getTime()
  ) {
    return NextResponse.json(
      { error: "פג זמן העריכה או אין הרשאה" },
      { status: 403 }
    );
  }

  const patch: any = {};

  const nextMessage = String(form.get("message") || "").trim();
  const nextLink = String(form.get("link_url") || "").trim();

  if (nextMessage) patch.message = nextMessage;
  patch.link_url = nextLink || null;

  /* --- החלפת מדיה --- */
  const media = form.get("media");
  if (media instanceof File && media.size > 0) {
    const isImage = media.type.startsWith("image/");
    const isVideo = media.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "קובץ לא נתמך" }, { status: 400 });
    }

    const ext = media.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("uploads")
      .upload(fileName, media, {
        contentType: media.type,
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    patch.media_url = supabase.storage
      .from("uploads")
      .getPublicUrl(fileName).data.publicUrl;
    patch.media_type = isImage ? "image" : "video";
  }

  const { error: upErr } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

/* =========================
   DELETE – מחיקה
========================= */
export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const ownerToken = getOwnerToken(req);
  if (!ownerToken) {
    return NextResponse.json({ error: "חסר owner token" }, { status: 400 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "חסר id" }, { status: 400 });
  }

  const { data: post } = await supabase
    .from("posts")
    .select("owner_token, editable_until")
    .eq("id", id)
    .single();

  if (
    !post ||
    post.owner_token !== ownerToken ||
    Date.now() > new Date(post.editable_until).getTime()
  ) {
    return NextResponse.json(
      { error: "אין הרשאה למחיקה" },
      { status: 403 }
    );
  }

  await supabase.from("posts").delete().eq("id", id);

  return NextResponse.json({ ok: true }, { status: 200 });
}

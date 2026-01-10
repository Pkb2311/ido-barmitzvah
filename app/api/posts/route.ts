// app/api/posts/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

const EDIT_WINDOW_MS = 60 * 60 * 1000; // שעה

function addMsIso(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

function getOwnerTokenFromReq(req: Request) {
  return req.headers.get("x-owner-token") || "";
}

function isStillEditable(editable_until: string | null) {
  if (!editable_until) return false;
  const t = new Date(editable_until).getTime();
  return Date.now() <= t;
}

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const ownerToken = getOwnerTokenFromReq(req); // אופציונלי (אם אין - פשוט לא יהיה can_edit)

  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at, name, message, media_url, media_type, link_url, approved, editable_until, owner_token")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safe = (data || []).map((p: any) => {
    const can_edit =
      !!ownerToken && p.owner_token === ownerToken && isStillEditable(p.editable_until || null);

    return {
      id: p.id,
      created_at: p.created_at,
      name: p.name,
      message: p.message,
      media_url: p.media_url,
      media_type: p.media_type,
      link_url: p.link_url,
      editable_until: p.editable_until,
      can_edit, // ✅ בלי לחשוף owner_token
    };
  });

  return NextResponse.json({ data: safe }, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const ownerToken = getOwnerTokenFromReq(req);

  if (!ownerToken) {
    return NextResponse.json({ error: "חסר owner token" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ error: "הבקשה חייבת להיות FormData" }, { status: 400 });
  }

  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  const message = String(form.get("message") || "").trim();
  const link_url_raw = String(form.get("link_url") || "").trim();
  const link_url = link_url_raw ? link_url_raw : null;

  if (!name || !message) {
    return NextResponse.json({ error: "חובה למלא שם וברכה" }, { status: 400 });
  }

  let media_url: string | null = null;
  let media_type: "image" | "video" | null = null;

  const media = form.get("media");
  if (media && media instanceof File && media.size > 0) {
    const isVideo = media.type.startsWith("video/");
    const isImage = media.type.startsWith("image/");
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
    }

    media_type = isVideo ? "video" : "image";

    const ext = (media.name.split(".").pop() || "").toLowerCase();
    const safeExt = ext && ext.length <= 6 ? ext : (isVideo ? "mp4" : "jpg");
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

    const { error: upErr } = await supabase.storage.from("uploads").upload(fileName, media, {
      cacheControl: "3600",
      upsert: false,
      contentType: media.type,
    });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from("uploads").getPublicUrl(fileName);
    media_url = pub?.publicUrl || null;
  }

  const approved = false; // או true אם אתה רוצה אישור מיידי
  const editable_until = addMsIso(EDIT_WINDOW_MS);

  const { data, error } = await supabase
    .from("posts")
    .insert({
      name,
      message,
      link_url,
      media_url,
      media_type,
      approved,
      owner_token: ownerToken,
      editable_until,
    })
    .select("id, approved, editable_until")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      id: data.id,
      approved: data.approved,
      editable_until: data.editable_until,
    },
    { status: 200 }
  );
}

export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const ownerToken = getOwnerTokenFromReq(req);
  if (!ownerToken) return NextResponse.json({ error: "חסר owner token" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();

  const nextMessage = typeof body?.message === "string" ? body.message.trim() : null;
  const nextLink = typeof body?.link_url === "string" ? body.link_url.trim() : null;
  const removeMedia = body?.remove_media === true;

  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });

  const { data: row, error: getErr } = await supabase
    .from("posts")
    .select("id, owner_token, editable_until")
    .eq("id", id)
    .single();

  if (getErr || !row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  const stillEditable = isStillEditable(row.editable_until || null);

  if (row.owner_token !== ownerToken || !stillEditable) {
    return NextResponse.json({ error: "אין הרשאה לעריכה (או שפג הזמן)" }, { status: 403 });
  }

  const patch: any = {};
  if (nextMessage !== null) patch.message = nextMessage;
  if (nextLink !== null) patch.link_url = nextLink || null;
  if (removeMedia) {
    patch.media_url = null;
    patch.media_type = null;
  }

  const { error: upErr } = await supabase.from("posts").update(patch).eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const ownerToken = getOwnerTokenFromReq(req);
  if (!ownerToken) return NextResponse.json({ error: "חסר owner token" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });

  const { data: row, error: getErr } = await supabase
    .from("posts")
    .select("id, owner_token, editable_until")
    .eq("id", id)
    .single();

  if (getErr || !row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  const stillEditable = isStillEditable(row.editable_until || null);

  if (row.owner_token !== ownerToken || !stillEditable) {
    return NextResponse.json({ error: "אין הרשאה למחיקה (או שפג הזמן)" }, { status: 403 });
  }

  const { error: delErr } = await supabase.from("posts").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

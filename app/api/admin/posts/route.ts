import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

type AnyRow = Record<string, any>;

function pickFirst(row: AnyRow, keys: string[]) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function normalizeMediaType(v: any): string | null {
  if (!v) return null;
  const s = String(v).toLowerCase();

  // עברית/אנגלית
  if (s.includes("video") || s.includes("וידאו") || s.includes("סרטון")) return "video";
  if (s.includes("image") || s.includes("תמונה") || s.includes("img")) return "image";

  // fallback
  return null;
}

function normalizeRow(row: AnyRow) {
  const name = pickFirst(row, ["name", "names", "שם"]);
  const message = pickFirst(row, ["message", "msg", "מזז", "ברכה", "טקסט", "message age", "הודעה"]);
  const media_url = pickFirst(row, ["media_url", "media", "כתובת_מדיה", "mediaUrl"]);
  const media_type_raw = pickFirst(row, ["media_type", "סוג_מדיה", "mediaType"]);
  const link_url = pickFirst(row, ["link_url", "url", "קישור_URL", "קישור_כתובת", "linkUrl"]);

  return {
    id: row.id,
    created_at: row.created_at,
    name: name ?? "—",
    message: message ?? "",
    media_url: media_url ?? null,
    media_type: normalizeMediaType(media_type_raw),
    link_url: link_url ?? null,
    approved: !!row.approved,
  };
}

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // pending | approved | all

  let q = supabase
    .from("posts")
    .select("id, created_at, name, message, media_url, media_type, link_url, approved, *")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status === "pending") q = q.eq("approved", false);
  if (status === "approved") q = q.eq("approved", true);

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normalized = (data ?? []).map(normalizeRow);

  return NextResponse.json({ data: normalized, per_page: 200 });
}

export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);

  const id = body?.id;
  const approved = body?.approved;

  if (!id || typeof approved !== "boolean") {
    return NextResponse.json({ error: "Invalid body. Expect { id, approved }" }, { status: 400 });
  }

  const { error } = await supabase
    .from("posts")
    .update({ approved })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);
  const id = body?.id;

  if (!id) {
    return NextResponse.json({ error: "Invalid body. Expect { id }" }, { status: 400 });
  }

  // (אופציונלי) אפשר גם למחוק קובץ מהסטורג' אם תרצה – כרגע מוחקים רק מהרשומה
  const { error } = await supabase.from("posts").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

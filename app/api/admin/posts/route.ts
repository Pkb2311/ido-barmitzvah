import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function filenameFromPublicUrl(url: string) {
  // public url looks like:
  // https://xxxx.supabase.co/storage/v1/object/public/uploads/<filename>
  const marker = "/storage/v1/object/public/uploads/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length);
}

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "pending").toLowerCase();

  let q = supabase
    .from("posts")
    .select("id, created_at, name, message, media_url, media_type, link_url, approved")
    .order("created_at", { ascending: false });

  if (status === "pending") q = q.eq("approved", false);
  if (status === "approved") q = q.eq("approved", true);
  // status === "all" -> no filter

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

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

export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // first get row to delete related file (optional)
  const { data: row, error: getErr } = await supabase
    .from("posts")
    .select("media_url")
    .eq("id", body.id)
    .maybeSingle();

  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });

  // delete row
  const { error: delErr } = await supabase.from("posts").delete().eq("id", body.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // try delete file from storage if exists
  const mediaUrl = row?.media_url as string | null | undefined;
  if (mediaUrl) {
    const name = filenameFromPublicUrl(mediaUrl);
    if (name) {
      // ignore storage delete errors (row already deleted)
      await supabase.storage.from("uploads").remove([name]);
    }
  }

  return NextResponse.json({ ok: true });
}

// app/api/admin/posts/route.ts
// ניהול ברכות (ממתינים / מאושרים) – מיועד לעמוד /admin

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

type AdminPostRow = {
  id: string;
  created_at: string;
  name: string;
  message: string;
  media_url: string | null;
  media_type: string | null;
  link_url: string | null;
  approved: boolean;
};

function parseBool(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "approved").toLowerCase();
  const wantApproved = status !== "pending"; // pending => false

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at, name, message, media_url, media_type, link_url, approved")
    .eq("approved", wantApproved)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []) as AdminPostRow[] }, { status: 200 });
}

export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);

  const id = String(body?.id || "").trim();
  const approved = parseBool(body?.approved);
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const message = typeof body?.message === "string" ? body.message.trim() : null;
  const link_url = typeof body?.link_url === "string" ? body.link_url.trim() : null;
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  if (approved === null && name === null && message === null && link_url === null) {
    return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });
  }

  const patch: any = {};
  if (approved !== null) patch.approved = approved;
  if (name !== null) {
    if (!name) return NextResponse.json({ error: "השם לא יכול להיות ריק" }, { status: 400 });
    patch.name = name;
  }
  if (message !== null) patch.message = message;
  if (link_url !== null) patch.link_url = link_url || null;

  const { error } = await supabase.from("posts").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

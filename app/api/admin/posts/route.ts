// app/api/admin/posts/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

function mustBeServiceRole() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "חסר SUPABASE_SERVICE_ROLE_KEY ב-Vercel (חובה לאדמין)";
  }
  return null;
}

// GET /api/admin/posts?status=pending|approved|all
export async function GET(req: Request) {
  const missing = mustBeServiceRole();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "pending").toLowerCase();

  const supabase = supabaseServer();

  let q = supabase
    .from("posts")
    .select("id,created_at,name,message,media_url,media_type,link_url,approved,editable_until")
    .order("created_at", { ascending: false })
    .limit(500);

  if (status === "pending") q = q.eq("approved", false);
  if (status === "approved") q = q.eq("approved", true);

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] }, { status: 200 });
}

// PATCH /api/admin/posts  { id, approved }
export async function PATCH(req: Request) {
  const missing = mustBeServiceRole();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  const supabase = supabaseServer();

  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  const approved = body?.approved;

  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  if (typeof approved !== "boolean") return NextResponse.json({ error: "חסר approved boolean" }, { status: 400 });

  const { error } = await supabase.from("posts").update({ approved }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

// DELETE /api/admin/posts  { id }
export async function DELETE(req: Request) {
  const missing = mustBeServiceRole();
  if (missing) return NextResponse.json({ error: missing }, { status: 500 });

  const supabase = supabaseServer();

  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

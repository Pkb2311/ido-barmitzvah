import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// מחזיר פוסטים לניהול (גם לא מאושרים), + אפשר לשנות approved
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const approved = searchParams.get("approved"); // "true"/"false"/null
  const limit = Number(searchParams.get("limit") ?? 200);

  const supabase = supabaseServer();

  let q = supabase
    .from("posts")
    .select("id, created_at, name, message, media_url, media_type, link_url, approved")
    .order("created_at", { ascending: false })
    .limit(isFinite(limit) ? limit : 200);

  if (approved === "true") q = q.eq("approved", true);
  if (approved === "false") q = q.eq("approved", false);

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

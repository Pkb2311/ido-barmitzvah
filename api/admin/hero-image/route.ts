export const runtime = "nodejs";

// app/api/admin/hero-image/route.ts
// העלאה/רשימה/מחיקה של תמונות "הילד" (Hero) ב-storage

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

function safeExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m ? m[1] : "jpg";
  // ext whitelist
  if (!/^(png|jpg|jpeg|webp|gif)$/.test(ext)) return "jpg";
  return ext;
}

function makePath(originalName: string) {
  const ext = safeExt(originalName || "");
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now();
  return `hero/${ts}_${rand}.${ext}`;
}

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.storage.from("uploads").list("hero", {
    limit: 100,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items =
    (data || [])
      .filter((x) => x?.name && !x.name.endsWith("/"))
      .map((x) => {
        const path = `hero/${x.name}`;
        const { data: pub } = supabase.storage.from("uploads").getPublicUrl(path);
        return {
          name: x.name,
          path,
          publicUrl: pub?.publicUrl || null,
          created_at: (x as any).created_at || null,
        };
      });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "אין טופס" }, { status: 400 });

  const file = (fd.get("file") || fd.get("image")) as File | null;
  if (!file) return NextResponse.json({ error: "חסר קובץ (file)" }, { status: 400 });

  const path = makePath(file.name || "hero.jpg");
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("uploads").upload(path, buf, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = supabase.storage.from("uploads").getPublicUrl(path);
  return NextResponse.json({ path, publicUrl: pub?.publicUrl || null }, { status: 200 });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);
  const path = String(body?.path || "").trim();
  if (!path) return NextResponse.json({ error: "חסר path" }, { status: 400 });

  const { error } = await supabase.storage.from("uploads").remove([path]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

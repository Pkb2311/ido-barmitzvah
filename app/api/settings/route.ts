// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getPath(obj: any, path: string[]): any {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as any)[key];
  }
  return cur;
}

function pickFirstString(...candidates: any[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

export async function GET() {
  const supabase = supabasePublic();

  const { data } = await supabase.from("site_settings").select("key,value");
  const byKey: Record<string, any> = {};
  for (const row of data ?? []) byKey[row.key] = row.value ?? {};

  const site = byKey["site"] ?? {};
  const ui =
    site.ui ??
    site.u ??
    byKey["ui"] ??
    byKey["ui_settings"] ??
    null;

  const require_approval = site.require_approval ?? true;

  // Payment links can live in different places depending on admin UI versions.
  const paybox_url = pickFirstString(
    site.paybox_url,
    site.paybox,
    getPath(site, ["payments", "paybox_url"]),
    getPath(site, ["payments", "paybox"]),
    getPath(site, ["gift", "paybox_url"]),
    getPath(site, ["gift", "paybox"]),
    getPath(site, ["gifts", "paybox_url"]),
    getPath(site, ["gifts", "paybox"]),
    getPath(byKey["ui_settings"], ["payments", "paybox_url"]),
    getPath(byKey["ui_settings"], ["gift", "paybox_url"])
  );

  const bit_url = pickFirstString(
    site.bit_url,
    site.bit,
    getPath(site, ["payments", "bit_url"]),
    getPath(site, ["payments", "bit"]),
    getPath(site, ["gift", "bit_url"]),
    getPath(site, ["gift", "bit"]),
    getPath(site, ["gifts", "bit_url"]),
    getPath(site, ["gifts", "bit"]),
    getPath(byKey["ui_settings"], ["payments", "bit_url"]),
    getPath(byKey["ui_settings"], ["gift", "bit_url"])
  );

  return NextResponse.json(
    {
      require_approval,
      ui,
      payments: {
        paybox_url,
        bit_url,
      },
    },
    { status: 200 }
  );
}

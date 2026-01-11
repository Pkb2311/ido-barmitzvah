// app/api/admin/settings/route.ts
// ניהול הגדרות אתר (require_approval + UI)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "../../../../lib/supabaseServer";

type UIButtonCfg = { show: boolean; label: string; color: "default" | "danger" | "send"; custom_color?: string | null };
type UISettings = {
  theme: {
    send_color: string;
    default_color: string;
    danger_color: string;
    bg: string;
    card_bg: string;
  };
  buttons: {
    upload: UIButtonCfg;
    camera: UIButtonCfg;
    link: UIButtonCfg;
    remove: UIButtonCfg;
    refresh: UIButtonCfg;
  };
};

type SiteSettingsValue = {
  require_approval: boolean;
  ui: UISettings;
  hero_image_url: string | null;
  hero_link_url: string | null;
};

const DEFAULT_VALUE: SiteSettingsValue = {
  require_approval: true,
  ui: {
    theme: {
      send_color: "#2ecc71",
      default_color: "#ff9500",
      danger_color: "#ff3b30",
      bg: "#0b1020",
      card_bg: "rgba(255,255,255,0.04)",
    },
    buttons: {
      upload: { show: true, label: "העלאת תמונה/וידאו", color: "default" },
      camera: { show: true, label: "📸 צילום תמונה", color: "default" },
      link: { show: true, label: "🔗 צרף קישור", color: "default" },
      remove: { show: true, label: "הסר קובץ", color: "danger" },
      refresh: { show: true, label: "רענון", color: "default" },
    },
  },
  hero_image_url: null,
  hero_link_url: null,
};

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isValidBtnColor(x: any): x is UIButtonCfg["color"] {
  return x === "default" || x === "danger" || x === "send";
}

function normalizeValue(input: any, base?: SiteSettingsValue): SiteSettingsValue {
  // מוודא מבנה כדי שלא יישמרו טיפוסים מוזרים
  const v = (input && typeof input === "object") ? input : {};
  const b = base || DEFAULT_VALUE;

  const require_approval = typeof v.require_approval === "boolean" ? v.require_approval : b.require_approval;
  const uiIn = (v.ui && typeof v.ui === "object") ? v.ui : (b.ui as any);

  const themeIn = (uiIn.theme && typeof uiIn.theme === "object") ? uiIn.theme : {};
  const theme = {
    send_color: typeof themeIn.send_color === "string" ? themeIn.send_color : b.ui.theme.send_color,
    default_color: typeof themeIn.default_color === "string" ? themeIn.default_color : b.ui.theme.default_color,
    danger_color: typeof themeIn.danger_color === "string" ? themeIn.danger_color : b.ui.theme.danger_color,
    bg: typeof themeIn.bg === "string" ? themeIn.bg : b.ui.theme.bg,
    card_bg: typeof themeIn.card_bg === "string" ? themeIn.card_bg : b.ui.theme.card_bg,
  };

  const btnsIn = (uiIn.buttons && typeof uiIn.buttons === "object") ? uiIn.buttons : {};

function normBtn(key: keyof UISettings["buttons"]): UIButtonCfg {
  const inBtn = (uiIn.buttons && typeof uiIn.buttons === "object") ? (uiIn.buttons as any)[key] : {};
  const baseBtn = (b.ui.buttons as any)[key] || (DEFAULT_VALUE.ui.buttons as any)[key];

  const show = typeof inBtn?.show === "boolean" ? inBtn.show : baseBtn.show;
  const label = typeof inBtn?.label === "string" ? inBtn.label : baseBtn.label;

  const colorIn = inBtn?.color;
  const color: UIButtonCfg["color"] = (colorIn === "default" || colorIn === "danger" || colorIn === "send") ? colorIn : baseBtn.color;

  const cc = inBtn?.custom_color;
  const custom_color =
    typeof cc === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cc.trim())
      ? cc.trim()
      : (cc === null ? null : (baseBtn.custom_color ?? null));

  return { show, label, color, custom_color };
}

  const ui: UISettings = {
    theme,
    buttons: {
      upload: normBtn("upload"),
      camera: normBtn("camera"),
      link: normBtn("link"),
      remove: normBtn("remove"),
      refresh: normBtn("refresh"),
    },
  };

  const hero_image_url = typeof v.hero_image_url === "string" ? v.hero_image_url : b.hero_image_url;
  const hero_link_url = typeof v.hero_link_url === "string" ? v.hero_link_url : b.hero_link_url;

  return { require_approval, ui, hero_image_url, hero_link_url };
}

async function readCurrent() {
  const supabase = supabasePublic(); // קריאה יכולה להיות גם עם anon (אם יש RLS פתוח)
  const { data } = await supabase.from("site_settings").select("key,value").eq("key", "site").single();
  return normalizeValue(data?.value);
}

export async function GET() {
  const value = await readCurrent();
  return NextResponse.json({ value }, { status: 200 });
}

// Admin UI הישן שולח PATCH { ui }
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const current = await readCurrent();
  const next = normalizeValue({ ...current, ui: body?.ui ?? current.ui }, current);

  const supabase = supabaseServer();
  const { error } = await supabase.from("site_settings").upsert({ key: "site", value: next }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

// Admin חדש שולח PUT { value }
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const current = await readCurrent();
  const next = normalizeValue(body?.value, current);

  const supabase = supabaseServer();
  const { error } = await supabase.from("site_settings").upsert({ key: "site", value: next }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

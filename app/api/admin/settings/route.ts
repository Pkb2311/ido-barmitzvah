// app/api/admin/settings/route.ts
// ניהול הגדרות אתר (require_approval + UI)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "../../../../lib/supabaseServer";

type UIButtonCfg = { show: boolean; label: string; color: "default" | "danger" | "send" };
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
  content: {
    event_kind: string;
    honoree_name: string;
    header_title: string;
    header_subtitle: string;
    form_title: string;
  };
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
};

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isValidBtnColor(x: any): x is UIButtonCfg["color"] {
  return x === "default" || x === "danger" || x === "send";
}

function normalizeValue(input: any): SiteSettingsValue {
  // מוודא מבנה כדי שלא יישמרו טיפוסים מוזרים
  const v = (input && typeof input === "object") ? input : {};

  const require_approval = typeof v.require_approval === "boolean" ? v.require_approval : DEFAULT_VALUE.require_approval;
  const uiIn = (v.ui && typeof v.ui === "object") ? v.ui : {};

  const themeIn = (uiIn.theme && typeof uiIn.theme === "object") ? uiIn.theme : {};
  const theme = {
    send_color: typeof themeIn.send_color === "string" ? themeIn.send_color : DEFAULT_VALUE.ui.theme.send_color,
    default_color: typeof themeIn.default_color === "string" ? themeIn.default_color : DEFAULT_VALUE.ui.theme.default_color,
    danger_color: typeof themeIn.danger_color === "string" ? themeIn.danger_color : DEFAULT_VALUE.ui.theme.danger_color,
    bg: typeof themeIn.bg === "string" ? themeIn.bg : DEFAULT_VALUE.ui.theme.bg,
    card_bg: typeof themeIn.card_bg === "string" ? themeIn.card_bg : DEFAULT_VALUE.ui.theme.card_bg,
  };

  const btnsIn = (uiIn.buttons && typeof uiIn.buttons === "object") ? uiIn.buttons : {};

  function normBtn(key: keyof UISettings["buttons"]): UIButtonCfg {
    const b = (btnsIn[key] && typeof btnsIn[key] === "object") ? btnsIn[key] : {};
    return {
      show: typeof b.show === "boolean" ? b.show : DEFAULT_VALUE.ui.buttons[key].show,
      label: typeof b.label === "string" ? b.label : DEFAULT_VALUE.ui.buttons[key].label,
      color: isValidBtnColor(b.color) ? b.color : DEFAULT_VALUE.ui.buttons[key].color,
    };
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

  return { require_approval, ui };
}

async function readCurrent() {
  const supabase = supabaseServer(); // ✅ במקום anon
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "site")
    .single();

  if (error) return DEFAULT_VALUE; // או normalizeValue(null)
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
  const next = normalizeValue({ ...current, ui: body?.ui ?? current.ui });

  const supabase = supabaseServer();
  const { error } = await supabase.from("site_settings").upsert({ key: "site", value: next }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

// Admin חדש שולח PUT { value }
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const next = normalizeValue(body?.value);

  const supabase = supabaseServer();
  const { error } = await supabase.from("site_settings").upsert({ key: "site", value: next }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

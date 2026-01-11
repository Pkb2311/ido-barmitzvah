// app/api/admin/settings/route.ts
// ניהול הגדרות אתר (site_settings.key='site') — כולל UI / כותרות / תמונות / תשלומים

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type ContentSettings = {
  event_kind: string;
  honoree_name: string;
  header_title: string;
  header_subtitle: string;
  form_title: string;
};

type PaymentsSettings = {
  enabled: boolean;
  bit_url: string;
  paybox_url: string;
  title?: string;
};

type SiteValue = {
  require_approval: boolean;
  ui: UISettings;
  hero_image_url: string | null;
  hero_link_url: string | null;
  content: ContentSettings;
  payments: PaymentsSettings;
};

const DEFAULT_VALUE: SiteValue = {
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
  content: {
    event_kind: "בר מצווה",
    honoree_name: "עידו",
    header_title: "🎉 בר מצווה",
    header_subtitle: "כתבו ברכה לעידו. אפשר לצרף תמונה/וידאו או להוסיף קישור. במובייל אפשר גם לצלם ישר מהדף.",
    form_title: "אשמח לברכה מרגשת ממך",
  },
  payments: { enabled: false, bit_url: "", paybox_url: "", title: "🎁 שליחת מתנה" },
};

function isPlainObject(v: any) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base: any, patch: any) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out: any = { ...base };
  for (const k of Object.keys(patch)) {
    const bv = (base as any)[k];
    const pv = (patch as any)[k];
    out[k] = isPlainObject(bv) && isPlainObject(pv) ? deepMerge(bv, pv) : pv;
  }
  return out;
}

function normalizeValue(incoming: any, current: SiteValue): SiteValue {
  const b = current || DEFAULT_VALUE;
  const v = (incoming && typeof incoming === "object") ? incoming : {};

  const require_approval = typeof v.require_approval === "boolean" ? v.require_approval : b.require_approval;

  const uiIn = isPlainObject(v.ui) ? v.ui : {};
  const themeIn = isPlainObject(uiIn.theme) ? uiIn.theme : {};
  const theme = {
    send_color: typeof themeIn.send_color === "string" ? themeIn.send_color : b.ui.theme.send_color,
    default_color: typeof themeIn.default_color === "string" ? themeIn.default_color : b.ui.theme.default_color,
    danger_color: typeof themeIn.danger_color === "string" ? themeIn.danger_color : b.ui.theme.danger_color,
    bg: typeof themeIn.bg === "string" ? themeIn.bg : b.ui.theme.bg,
    card_bg: typeof themeIn.card_bg === "string" ? themeIn.card_bg : b.ui.theme.card_bg,
  };

  const buttonsIn = isPlainObject(uiIn.buttons) ? uiIn.buttons : {};
  function normBtn(key: keyof UISettings["buttons"]): UIButtonCfg {
    const inBtn: any = (buttonsIn as any)[key] || {};
    const baseBtn: any = (b.ui.buttons as any)[key];

    const show = typeof inBtn.show === "boolean" ? inBtn.show : baseBtn.show;
    const label = typeof inBtn.label === "string" ? inBtn.label : baseBtn.label;

    const c = inBtn.color;
    const color: UIButtonCfg["color"] = (c === "default" || c === "danger" || c === "send") ? c : baseBtn.color;

    const custom_color = typeof inBtn.custom_color === "string" ? inBtn.custom_color : (inBtn.custom_color === null ? null : (baseBtn.custom_color ?? null));

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

  const cIn = isPlainObject(v.content) ? v.content : {};
  const content: ContentSettings = {
    event_kind: typeof cIn.event_kind === "string" && cIn.event_kind.trim() ? cIn.event_kind.trim() : b.content.event_kind,
    honoree_name: typeof cIn.honoree_name === "string" && cIn.honoree_name.trim() ? cIn.honoree_name.trim() : b.content.honoree_name,
    header_title: typeof cIn.header_title === "string" && cIn.header_title.trim() ? cIn.header_title.trim() : b.content.header_title,
    header_subtitle: typeof cIn.header_subtitle === "string" && cIn.header_subtitle.trim() ? cIn.header_subtitle.trim() : b.content.header_subtitle,
    form_title: typeof cIn.form_title === "string" && cIn.form_title.trim() ? cIn.form_title.trim() : b.content.form_title,
  };

  // fallbacks based on event kind
  if (!content.header_title) content.header_title = `🎉 ${content.event_kind}`;

  const pIn = isPlainObject(v.payments) ? v.payments : {};
  const payments: PaymentsSettings = {
    enabled: typeof pIn.enabled === "boolean" ? pIn.enabled : b.payments.enabled,
    bit_url: typeof pIn.bit_url === "string" ? pIn.bit_url : b.payments.bit_url,
    paybox_url: typeof pIn.paybox_url === "string" ? pIn.paybox_url : b.payments.paybox_url,
    title: typeof pIn.title === "string" ? pIn.title : b.payments.title,
  };

  return { require_approval, ui, hero_image_url, hero_link_url, content, payments };
}

async function readCurrentRaw() {
  const supabase = supabaseServer();
  const { data } = await supabase.from("site_settings").select("key,value").eq("key", "site").single();
  return (data?.value && typeof data.value === "object") ? data.value : {};
}

export async function GET() {
  const raw = await readCurrentRaw();
  const normalized = normalizeValue(raw, DEFAULT_VALUE);
  return NextResponse.json({ value: normalized }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}

// PUT { value } — תומך גם בעדכון חלקי (מיזוג עם הערכים הקיימים)
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const patch = (body?.value && typeof body.value === "object") ? body.value : {};
  const currentRaw = await readCurrentRaw();
  const mergedRaw = deepMerge(currentRaw, patch);
  const next = normalizeValue(mergedRaw, DEFAULT_VALUE);

  const supabase = supabaseServer();
  const { error } = await supabase.from("site_settings").upsert({ key: "site", value: next }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}

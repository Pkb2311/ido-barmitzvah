import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

const DEFAULT_UI = {
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
};

export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "ui_settings").single();

  if (error) {
    return NextResponse.json({ ok: true, ui: DEFAULT_UI }, { status: 200 });
  }

  return NextResponse.json({ ok: true, ui: data?.value || DEFAULT_UI }, { status: 200 });
}

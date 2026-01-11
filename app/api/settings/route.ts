// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("site_settings").select("key,value").eq("key", "site").single();

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );

  const v: any = data?.value || {};
  const require_approval = typeof v?.require_approval === "boolean" ? v.require_approval : true;

  const ui = (v?.ui && typeof v.ui === "object") ? v.ui : null;

  const hero_image_url = typeof v?.hero_image_url === "string" ? v.hero_image_url : null;
  const hero_link_url = typeof v?.hero_link_url === "string" ? v.hero_link_url : null;

  const content = {
    event_kind: typeof v?.content?.event_kind === "string" ? v.content.event_kind : "בר מצווה",
    honoree_name: typeof v?.content?.honoree_name === "string" ? v.content.honoree_name : "עידו",
    header_title: typeof v?.content?.header_title === "string" ? v.content.header_title : "🎉 בר מצווה",
    header_subtitle:
      typeof v?.content?.header_subtitle === "string"
        ? v.content.header_subtitle
        : "כתבו ברכה לעידו. אפשר לצרף תמונה/וידאו או להוסיף קישור. במובייל אפשר גם לצלם ישר מהדף.",
    form_title: typeof v?.content?.form_title === "string" ? v.content.form_title : "אשמח לברכה מרגשת ממך",
  };

  const payments = {
    enabled: typeof v?.payments?.enabled === "boolean" ? v.payments.enabled : false,
    bit_url: typeof v?.payments?.bit_url === "string" ? v.payments.bit_url : "",
    paybox_url: typeof v?.payments?.paybox_url === "string" ? v.payments.paybox_url : "",
    title: typeof v?.payments?.title === "string" ? v.payments.title : "🎁 שליחת מתנה",
  };

  return NextResponse.json(
    { require_approval, ui, hero_image_url, hero_link_url, content, payments },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

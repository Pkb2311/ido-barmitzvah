// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const supabase = supabasePublic();
  const { data, error } = await supabase.from("site_settings").select("key,value").eq("key", "site").single();

  if (error)
    return NextResponse.json(
      {
        ui: null,
        require_approval: true,
        hero_image_url: null,
        hero_link_url: null,
        content: {
          event_kind: "בר מצווה",
          honoree_name: "עידו",
          header_title: "🎉 בר מצווה",
          header_subtitle:
            "כתבו ברכה לעידו. אפשר לצרף תמונה/וידאו או להוסיף קישור. במובייל אפשר גם לצלם ישר מהדף.",
          form_title: "אשמח לברכה מרגשת ממך",
        },
      },
      { status: 200 }
    );

  const require_approval = data?.value?.require_approval ?? true;
  const ui = data?.value?.ui ?? null;
  const hero_image_url = typeof data?.value?.hero_image_url === "string" ? data.value.hero_image_url : null;
  const hero_link_url = typeof data?.value?.hero_link_url === "string" ? data.value.hero_link_url : null;

  const v = data?.value;
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

  return NextResponse.json({ require_approval, ui, hero_image_url, hero_link_url, content }, { status: 200 });
}

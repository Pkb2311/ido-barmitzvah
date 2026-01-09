import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "upload_settings")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const value = data?.value ?? {
    max_video_mb: 50,
    max_image_mb: 10,
    image_max_width: 1600,
    image_quality: 0.82,
    per_page: 20,
  };

  return NextResponse.json({ value });
}


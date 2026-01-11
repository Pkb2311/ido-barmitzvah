// app/api/unfurl/route.ts
// תצוגה מקדימה לקישורים (OpenGraph) עם הגנות בסיסיות נגד SSRF

import { NextResponse } from "next/server";
import net from "net";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPrivateIp(ip: string) {
  // IPv4
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("192.168.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (ip === "0.0.0.0") return true;

  // IPv6 (basic)
  if (ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // unique local
  if (ip.startsWith("fe80")) return true; // link-local

  return false;
}

function pickMeta(html: string, keys: string[]) {
  for (const k of keys) {
    // property="og:title" content="..."
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
    const m1 = html.match(re1);
    if (m1?.[1]) return m1[1].trim();

    // content first, then property/name later
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${k}["'][^>]*>`, "i");
    const m2 = html.match(re2);
    if (m2?.[1]) return m2[1].trim();
  }
  return "";
}

function pickTitle(html: string) {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m?.[1]?.trim() || "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("url") || "";
    if (!raw) return NextResponse.json({ error: "missing url" }, { status: 400 });

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    if (url.protocol !== "http:" && url.protocol !== "https:")
      return NextResponse.json({ error: "invalid protocol" }, { status: 400 });

    const host = url.hostname.toLowerCase();
    if (!host) return NextResponse.json({ error: "invalid host" }, { status: 400 });
    if (host === "localhost" || host.endsWith(".local"))
      return NextResponse.json({ error: "blocked host" }, { status: 400 });

    const ipType = net.isIP(host);
    if (ipType && isPrivateIp(host)) return NextResponse.json({ error: "blocked ip" }, { status: 400 });

    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IdoBarmitzvahBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store" as any,
    });

    if (!res.ok) return NextResponse.json({ error: `fetch failed (${res.status})` }, { status: 400 });

    const finalUrl = res.url || url.toString();

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) {
      // לא HTML — נחזיר רק URL
      return NextResponse.json(
        { data: { url: finalUrl, title: new URL(finalUrl).hostname, description: "", image: "", site_name: "" } },
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const htmlRaw = await res.text();
    const html = htmlRaw.slice(0, 200_000);

    const ogTitle = pickMeta(html, ["og:title", "twitter:title"]);
    const ogDesc = pickMeta(html, ["og:description", "twitter:description", "description"]);
    const ogImg = pickMeta(html, ["og:image", "twitter:image"]);
    const ogSite = pickMeta(html, ["og:site_name"]);

    const title = ogTitle || pickTitle(html) || new URL(finalUrl).hostname;

    let image = ogImg || "";
    try {
      if (image) image = new URL(image, finalUrl).toString();
    } catch {
      // ignore
    }

    const data = {
      url: finalUrl,
      title,
      description: ogDesc || "",
      image,
      site_name: ogSite || "",
    };

    return NextResponse.json({ data }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unfurl error" }, { status: 500 });
  }
}

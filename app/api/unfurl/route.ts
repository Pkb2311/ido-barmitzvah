// app/api/unfurl/route.ts
// תצוגה מקדימה לקישורים (OpenGraph) עם הגנות בסיסיות נגד SSRF

import { NextResponse } from "next/server";
import net from "net";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UnfurlData = {
  url: string;
  title: string;
  description: string;
  image: string;
  site_name: string;
};

function safeHostname(u: string) {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

function minimalData(finalUrl: string): UnfurlData {
  return {
    url: finalUrl,
    title: safeHostname(finalUrl) || finalUrl,
    description: "",
    image: "",
    site_name: "",
  };
}

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

function hostIs(host: string, parts: string[]) {
  const h = host.toLowerCase();
  return parts.some((p) => h === p || h.endsWith(`.${p}`));
}


function extractYouTubeId(targetUrl: string): string | null {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (host.endsWith("youtube.com")) {
      // watch?v=<id>
      const v = u.searchParams.get("v");
      if (v) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => ["shorts", "live", "embed"].includes(p));
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

async function tryOEmbed(targetUrl: string): Promise<UnfurlData | null> {
  // לא כל אתר מאפשר unfurl מהשרת (403 וכו').
  // בשביל פלטפורמות נפוצות ננסה OEmbed (כשזמין) כדי לקבל title/thumbnail.
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();

  // YouTube oEmbed
  if (hostIs(host, ["youtube.com", "youtu.be", "m.youtube.com"])) {
    // YouTube oEmbed sometimes doesn't like shorts/live/embed urls directly.
    // Normalize to watch?v=<id> when possible.
    const ytId = extractYouTubeId(targetUrl);
    const normalized = ytId ? `https://www.youtube.com/watch?v=${ytId}` : targetUrl;
    const api = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(normalized)}`;
    try {
      const r = await fetch(api, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store" as any,
      });
      if (!r.ok) return null;
      const j: any = await r.json().catch(() => null);
      if (!j) return null;
      return {
        url: targetUrl,
        title: typeof j.title === "string" ? j.title : safeHostname(targetUrl),
        description: "",
        image: typeof j.thumbnail_url === "string" ? j.thumbnail_url : "",
        site_name: "YouTube",
      };
    } catch {
      return null;
    }
  }

  // TikTok oEmbed (בד"כ פתוח)
  if (hostIs(host, ["tiktok.com", "www.tiktok.com", "m.tiktok.com"])) {
    const api = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`;
    try {
      const r = await fetch(api, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store" as any,
      });
      if (!r.ok) return null;
      const j: any = await r.json().catch(() => null);
      if (!j) return null;
      return {
        url: targetUrl,
        title: typeof j.title === "string" ? j.title : safeHostname(targetUrl),
        description: "",
        image: typeof j.thumbnail_url === "string" ? j.thumbnail_url : "",
        site_name: "TikTok",
      };
    } catch {
      return null;
    }
  }

  // Instagram oEmbed: לעיתים דורש הרשאות; ננסה ואם נכשל נחזור null
  if (hostIs(host, ["instagram.com", "www.instagram.com"])) {
    const api = `https://www.instagram.com/oembed/?url=${encodeURIComponent(targetUrl)}`;
    try {
      const r = await fetch(api, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store" as any,
      });
      if (!r.ok) return null;
      const j: any = await r.json().catch(() => null);
      if (!j) return null;
      return {
        url: targetUrl,
        title: typeof j.title === "string" ? j.title : safeHostname(targetUrl),
        description: "",
        image: typeof j.thumbnail_url === "string" ? j.thumbnail_url : "",
        site_name: "Instagram",
      };
    } catch {
      return null;
    }
  }

  return null;
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

    // oEmbed for known providers (more reliable than HTML fetch for some sites)
    const oembed = await tryOEmbed(url.toString());
    if (oembed) {
      return NextResponse.json({ data: oembed }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cache: "no-store" as any,
    });

    if (!res.ok) {
      // נחזיר מידע מינימלי כדי שהלקוח עדיין יראה "כרטיס" במקום ליפול
      return NextResponse.json({ data: minimalData(url.toString()) }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    const finalUrl = res.url || url.toString();

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) {
      // לא HTML — נחזיר רק URL
      return NextResponse.json(
        { data: minimalData(finalUrl) },
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

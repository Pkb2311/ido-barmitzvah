// app/api/unfurl/route.ts
// תצוגה מקדימה לקישורים (OpenGraph) + oEmbed, עם הגנות בסיסיות נגד SSRF + בדיקה אחרי redirect + timeout

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
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
    const m1 = html.match(re1);
    if (m1?.[1]) return m1[1].trim();

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
  const h = host.toLowerCase().replace(/^www\./, "");
  return parts.some((p) => h === p || h.endsWith(`.${p}`));
}

function extractYouTubeId(targetUrl: string): string | null {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (host.endsWith("youtube.com")) {
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

// נרמול יוטיוב: תמיד watch?v=ID כשאפשר (עוזר ל-oEmbed וגם עקביות)
function normalizeYouTubeUrl(raw: string) {
  const id = extractYouTubeId(raw);
  return id ? `https://www.youtube.com/watch?v=${id}` : raw;
}

async function tryOEmbed(targetUrl: string): Promise<UnfurlData | null> {
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();

  // YouTube oEmbed
  if (hostIs(host, ["youtube.com", "youtu.be", "m.youtube.com"])) {
    const normalized = normalizeYouTubeUrl(targetUrl);
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
  if (hostIs(host, ["tiktok.com", "m.tiktok.com"])) {
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
  if (hostIs(host, ["instagram.com"])) {
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

function validateTargetUrlOrThrow(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid protocol");

  const host = url.hostname.toLowerCase();
  if (!host) throw new Error("invalid host");
  if (host === "localhost" || host.endsWith(".local")) throw new Error("blocked host");

  const ipType = net.isIP(host);
  if (ipType && isPrivateIp(host)) throw new Error("blocked ip");

  return url;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("url") || "";
    if (!raw) return NextResponse.json({ error: "missing url" }, { status: 400 });

    // ולידציה ראשונית
    const url = validateTargetUrlOrThrow(raw);

    // oEmbed קודם (הכי אמין לפלטפורמות “קשות”)
    const oembed = await tryOEmbed(url.toString());
    if (oembed) {
      return NextResponse.json({ data: oembed }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    // timeout כדי לא להיתקע
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 7000);

    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cache: "no-store" as any,
    }).finally(() => clearTimeout(t));

    // חשוב: אחרי redirect — לבדוק שוב שהכתובת הסופית בטוחה
    const finalUrl = res.url || url.toString();
    try {
      validateTargetUrlOrThrow(finalUrl);
    } catch {
      // אם הכתובת הסופית לא בטוחה – נחזיר מינימלי על המקור
      return NextResponse.json(
        { data: minimalData(url.toString()) },
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { data: minimalData(finalUrl) },
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) {
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

    const data: UnfurlData = {
      url: finalUrl,
      title,
      description: ogDesc || "",
      image,
      site_name: ogSite || "",
    };

    return NextResponse.json({ data }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e: any) {
    const msg = (e?.message || "").toLowerCase();
    const status =
      msg.includes("missing url") || msg.includes("invalid") || msg.includes("blocked") ? 400 : 500;

    return NextResponse.json({ error: e?.message || "unfurl error" }, { status });
  }
}

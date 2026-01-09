"use client";

import { useEffect, useState } from "react";

type Settings = {
  max_video_mb: number;
  max_image_mb: number;
  image_max_width: number;
  image_quality: number;
  per_page: number;
};

type Post = {
  id: string;
  created_at: string;
  name: string;
  message: string;
  media_url: string | null;
  media_type: string | null; // "image" | "video"
  link_url: string | null;
};

async function compressImage(file: File, maxWidth: number, quality: number): Promise<File> {
  // HEIC לפעמים לא נתמך בדפדפן — במקרה כזה נחזיר את המקור (השרת יבדוק גודל)
  if (file.type.includes("heic") || file.type.includes("heif")) return file;

  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Image load failed"));
  });

  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  URL.revokeObjectURL(url);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b || new Blob()), "image/webp", quality)
  );

  return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>({
    max_video_mb: 50,
    max_image_mb: 10,
    image_max_width: 1600,
    image_quality: 0.82,
    per_page: 20,
  });

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [media, setMedia] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState("");

  async function loadSettings() {
    const res = await fetch("/api/settings", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.value) setSettings(json.value);
  }

  async function loadPosts() {
    const res = await fetch("/api/posts", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setPosts(json.data || []);
  }

  useEffect(() => {
    loadSettings().then(loadPosts);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!name.trim() || !message.trim()) {
      setStatus("חובה למלא שם וברכה 🙂");
      return;
    }

    let finalMedia = media;

    // אם זו תמונה — מכווצים לפני העלאה
    if (finalMedia && finalMedia.type.startsWith("image/")) {
      try {
        finalMedia = await compressImage(finalMedia, settings.image_max_width, settings.image_quality);
      } catch {
        // אם כיווץ נכשל, נעלה את המקור (השרת יבדוק גודל)
      }
    }

    // בדיקה מקומית לפני שליחה (חווית משתמש)
    if (finalMedia?.type.startsWith("video/")) {
      const max = settings.max_video_mb * 1024 * 1024;
      if (finalMedia.size > max) {
        setStatus(`סרטון גדול מדי. מקסימום ${settings.max_video_mb}MB`);
        return;
      }
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("message", message.trim());
      if (linkUrl.trim()) fd.append("link_url", linkUrl.trim());
      if (finalMedia) fd.append("media", finalMedia);

      const res = await fetch("/api/posts", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json?.error || "שגיאה בשליחה");
        return;
      }

      setName("");
      setMessage("");
      setLinkUrl("");
      setMedia(null);
      setStatus("נשלח ✅ תודה!");
      await loadPosts();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: "10px 0", fontSize: 42 }}>בר מצווה של עידו 🎉</h1>
      <p style={{ opacity: 0.9, marginTop: 0 }}>
        מעלים תמונה/סרטון או קישור, וכותבים ברכה לעידו 💙
      </p>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>העלאת ברכה</h3>

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <input style={input} placeholder="שם" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea style={{ ...input, minHeight: 110 }} placeholder="ברכה לעידו…" value={message} onChange={(e) => setMessage(e.target.value)} />
          <input style={input} placeholder="קישור (אופציונלי) https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />

          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setMedia(e.target.files?.[0] || null)}
            style={{ color: "white" }}
          />

          <button disabled={loading} style={btn}>
            {loading ? "שולח..." : "שליחה"}
          </button>

          {status && <div style={{ opacity: 0.9 }}>{status}</div>}

          <div style={{ opacity: 0.7, fontSize: 12 }}>
            תמונות מכווצות אוטומטית. וידאו עד {settings.max_video_mb}MB.
          </div>
        </form>
      </section>

      <h2 style={{ marginTop: 28 }}>ברכות אחרונות</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {posts.map((p) => (
          <div key={p.id} style={card}>
            <div style={{ fontWeight: 900 }}>{p.name}</div>
            <div style={{ whiteSpace: "pre-wrap", opacity: 0.92, lineHeight: 1.6, marginTop: 6 }}>{p.message}</div>

            {p.media_url && p.media_type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.media_url} alt="תמונה" style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: 12, marginTop: 10 }} loading="lazy" />
            )}

            {p.media_url && p.media_type === "video" && (
              <video src={p.media_url} controls style={{ width: "100%", borderRadius: 12, marginTop: 10 }} preload="none" />
            )}

            {p.link_url && (
              <a href={p.link_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, color: "white" }}>
                פתח קישור ↗
              </a>
            )}

            <div style={{ opacity: 0.6, fontSize: 12, marginTop: 10 }}>
              {new Date(p.created_at).toLocaleString("he-IL")}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  padding: 16,
};

const input: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  fontSize: 16,
  outline: "none",
};

const btn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "white",
  color: "#0b1020",
  fontWeight: 900,
};

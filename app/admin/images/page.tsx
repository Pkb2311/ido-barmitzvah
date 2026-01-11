"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "../AdminNav";

type HeroItem = {
  name: string;
  path: string;
  publicUrl: string | null;
  created_at: string | null;
};

export default function AdminImagesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroLinkUrl, setHeroLinkUrl] = useState<string>("");

  const [items, setItems] = useState<HeroItem[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const canSave = useMemo(() => !!heroImageUrl || heroLinkUrl.trim().length > 0, [heroImageUrl, heroLinkUrl]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" as any });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בטעינת הגדרות");
      const v = j?.value || {};
      setHeroImageUrl(typeof v?.hero_image_url === "string" ? v.hero_image_url : null);
      setHeroLinkUrl(typeof v?.hero_link_url === "string" ? v.hero_link_url : "");

      const res2 = await fetch("/api/admin/hero-image", { cache: "no-store" as any });
      const j2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new Error(j2?.error || "שגיאה בטעינת תמונות");
      setItems(Array.isArray(j2?.items) ? j2.items : []);
    } catch (e: any) {
      setMsg(e?.message || "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function upload() {
    if (!file) {
      setMsg("בחר תמונה קודם");
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/hero-image", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בהעלאה");

      if (j?.publicUrl) {
        setHeroImageUrl(j.publicUrl);
        setMsg("הועלה ✅ עכשיו אפשר לשמור או לבחור תמונה");
      } else {
        setMsg("הועלה, אבל לא התקבל publicUrl");
      }

      setFile(null);
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);

    const link = heroLinkUrl.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      setMsg("הלינק חייב להתחיל ב-http/https");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: {
            hero_image_url: heroImageUrl,
            hero_link_url: link || null,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בשמירה");
      setMsg("נשמר ✅");
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(path: string) {
    const ok = window.confirm("למחוק את התמונה הזו מהאחסון? זה בלתי הפיך.");
    if (!ok) return;
    setMsg(null);
    try {
      const res = await fetch("/api/admin/hero-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה במחיקה");
      setMsg("נמחק ✅");
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message || "שגיאה במחיקה");
    }
  }

  const card: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
  };

  const btn = (kind: "primary" | "default" | "danger" = "default"): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.06)",
      color: "white",
      cursor: "pointer",
      fontWeight: 900,
    };
    if (kind === "primary") return { ...base, background: "rgba(46, 204, 113, 0.18)", borderColor: "rgba(46, 204, 113, 0.55)" };
    if (kind === "danger") return { ...base, background: "rgba(231, 76, 60, 0.18)", borderColor: "rgba(231, 76, 60, 0.55)" };
    return base;
  };

  return (
    <main style={{ padding: 18, direction: "rtl", maxWidth: 980, margin: "0 auto", color: "white" }}>
      <h1 style={{ marginTop: 0 }}>🖼️ ניהול תמונות</h1>
      <AdminNav current="images" />

      {msg ? <div style={{ marginBottom: 12, opacity: 0.95 }}>{msg}</div> : null}

      {loading ? (
        <div style={{ opacity: 0.85 }}>טוען…</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>תמונת הילד בראש הדף</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <div>
                <div style={{ opacity: 0.85, fontWeight: 900, marginBottom: 6 }}>תצוגה מקדימה</div>
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt="תמונת הילד"
                    style={{ width: 120, height: 120, borderRadius: 999, objectFit: "cover", border: "2px solid rgba(255,255,255,0.35)" }}
                  />
                ) : (
                  <div style={{ opacity: 0.8 }}>לא נבחרה תמונה עדיין</div>
                )}
              </div>

              <label>
                <div style={{ opacity: 0.85, fontWeight: 900, marginBottom: 6 }}>קישור בלחיצה על התמונה (חיצוני)</div>
                <input
                  value={heroLinkUrl}
                  onChange={(e) => setHeroLinkUrl(e.target.value)}
                  style={input}
                  placeholder="https://app.site123.com/...."
                />
                <div style={{ opacity: 0.75, marginTop: 6 }}>אם השדה ריק – הלחיצה על התמונה תהיה לא פעילה.</div>
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={save} disabled={saving || !canSave} style={btn("primary")}>
                  {saving ? "שומר..." : "שמור"}
                </button>
                <button onClick={loadAll} style={btn("default")}>
                  רענון
                </button>
              </div>
            </div>
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>העלאת תמונה חדשה</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button onClick={upload} disabled={!file || uploading} style={btn("primary")}>
                {uploading ? "מעלה..." : "העלה"}
              </button>
            </div>
            <div style={{ opacity: 0.75, marginTop: 10 }}>
              הטיפ: אחרי העלאה אפשר לבחור אותה מהרשימה למטה ואז לשמור.
            </div>
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>תמונות שהועלו (Hero)</h2>

            {items.length === 0 ? (
              <div style={{ opacity: 0.8 }}>אין עדיין תמונות.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {items.map((it) => (
                  <div key={it.path} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 10 }}>
                    {it.publicUrl ? (
                      <img src={it.publicUrl} alt={it.name} style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 12 }} />
                    ) : (
                      <div style={{ height: 130, opacity: 0.8 }}>no preview</div>
                    )}

                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setHeroImageUrl(it.publicUrl);
                          setMsg("נבחרה תמונה. אל תשכח לשמור ✅");
                        }}
                        style={btn("default")}
                        disabled={!it.publicUrl}
                      >
                        בחר
                      </button>
                      <button type="button" onClick={() => removeItem(it.path)} style={btn("danger")}>
                        מחק
                      </button>
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12, wordBreak: "break-word" }}>{it.name}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

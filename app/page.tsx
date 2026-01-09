"use client";

import { useEffect, useState } from "react";

type Settings = {
  max_video_mb: number;
  max_image_mb: number;
  image_max_width: number;
  image_quality: number;
  per_page: number;
};

export default function AdminPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const res = await fetch("/api/settings", { cache: "no-store" });
    const json = await res.json();
    setS(json.value);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!s) return;
    setMsg("שומר...");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg("שגיאה: " + (json?.error || "לא ידוע"));
      return;
    }
    setS(json.value);
    setMsg("נשמר ✅");
  }

  if (!s) return <main style={{ padding: 30 }}>טוען...</main>;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 30 }}>
      <h1 style={{ marginTop: 0 }}>ניהול – הגדרות העלאה 🔧</h1>

      <div style={{ display: "grid", gap: 12, background: "rgba(255,255,255,0.06)", padding: 16, borderRadius: 14 }}>
        <label>
          מגבלת וידאו (MB)
          <input type="number" value={s.max_video_mb} onChange={(e) => setS({ ...s, max_video_mb: Number(e.target.value) })}
            style={input} />
        </label>

        <label>
          מגבלת תמונה לפני כיווץ (MB)
          <input type="number" value={s.max_image_mb} onChange={(e) => setS({ ...s, max_image_mb: Number(e.target.value) })}
            style={input} />
        </label>

        <label>
          רוחב מקסימלי לתמונה אחרי כיווץ (px)
          <input type="number" value={s.image_max_width} onChange={(e) => setS({ ...s, image_max_width: Number(e.target.value) })}
            style={input} />
        </label>

        <label>
          איכות תמונה (0.4–0.95)
          <input type="number" step="0.01" value={s.image_quality} onChange={(e) => setS({ ...s, image_quality: Number(e.target.value) })}
            style={input} />
        </label>

        <label>
          כמה פריטים לטעון בדף (הגלריה)
          <input type="number" value={s.per_page} onChange={(e) => setS({ ...s, per_page: Number(e.target.value) })}
            style={input} />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={save} style={btn}>שמירה</button>
          <button onClick={load} style={btnGhost}>רענון</button>
        </div>

        {msg && <div style={{ opacity: 0.9 }}>{msg}</div>}
      </div>

      <p style={{ opacity: 0.75, marginTop: 14 }}>
        השינויים נכנסים לתוקף מיידית – בלי Deploy.
      </p>
    </main>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
};

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "white",
  color: "#0b1020",
  fontWeight: 800,
};

const btnGhost: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.25)",
  cursor: "pointer",
  background: "transparent",
  color: "white",
};

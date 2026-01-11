"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { AdminNav } from "../AdminNav";

type UIButtonCfg = { show: boolean; label: string; color: "default" | "danger" | "send"; custom_color?: string | null };
type UISettings = {
  theme: {
    send_color: string;
    default_color: string;
    danger_color: string;
    bg: string;
    card_bg: string;
  };
  buttons: {
    upload: UIButtonCfg;
    camera: UIButtonCfg;
    link: UIButtonCfg;
    remove: UIButtonCfg;
    refresh: UIButtonCfg;
  };
};

type SiteSettingsValue = {
  require_approval: boolean;
  ui: UISettings;
  hero_image_url: string | null;
  hero_link_url: string | null;
  content: {
    event_kind: string;
    honoree_name: string;
    header_title: string;
    header_subtitle: string;
    form_title: string;
  };
};

const DEFAULT_VALUE: SiteSettingsValue = {
  require_approval: true,
  ui: {
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
  },
  hero_image_url: null,
  hero_link_url: null,
  content: {
    event_kind: "בר מצווה",
    honoree_name: "עידו",
    header_title: "🎉 בר מצווה",
    header_subtitle: "כתבו ברכה לעידו. אפשר לצרף תמונה/וידאו או להוסיף קישור. במובייל אפשר גם לצלם ישר מהדף.",
    form_title: "אשמח לברכה מרגשת ממך",
  },
};

function card(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  };
}

function btn(kind: "primary" | "default"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
  if (kind === "primary") {
    return {
      ...base,
      background: "rgba(46,204,113,0.16)",
      border: "1px solid rgba(46,204,113,0.35)",
    };
  }
  return base;
}

export default function AdminSettingsPage() {
  const [value, setValue] = useState<SiteSettingsValue>(DEFAULT_VALUE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" as any });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בטעינת הגדרות");
      setValue((j?.value as SiteSettingsValue) || DEFAULT_VALUE);
    } catch (e: any) {
      setMsg(e?.message || "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setContent<K extends keyof SiteSettingsValue["content"]>(key: K, v: string) {
    setValue((prev) => ({ ...prev, content: { ...prev.content, [key]: v } }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בשמירה");
      setMsg("נשמר ✅");
    } catch (e: any) {
      setMsg(e?.message || "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 18, direction: "rtl", maxWidth: 900, margin: "0 auto", color: "white" }}>
      <h1 style={{ marginTop: 0 }}>🧩 ניהול תוכן וכותרות</h1>
      <AdminNav current="settings" />

      <div style={card()}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={load} style={btn("default")}>
            טען מחדש
          </button>
          <button onClick={save} style={btn("primary")} disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
        {msg ? <div style={{ marginTop: 10, opacity: 0.95 }}>{msg}</div> : null}
      </div>

      {loading ? (
        <div style={{ marginTop: 14, opacity: 0.85 }}>טוען…</div>
      ) : (
        <section style={{ ...card(), marginTop: 14 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <label>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>סוג אירוע (כללי)</div>
              <input
                value={value.content.event_kind}
                onChange={(e) => setContent("event_kind", e.target.value)}
                placeholder="בר מצווה / חתונה / יום הולדת"
                style={input()}
              />
            </label>

            <label>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>שם הילד/הזוג/החוגג</div>
              <input
                value={value.content.honoree_name}
                onChange={(e) => setContent("honoree_name", e.target.value)}
                placeholder="עידו / משה / ..."
                style={input()}
              />
            </label>

            <label>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>כותרת ראשית (H1)</div>
              <input
                value={value.content.header_title}
                onChange={(e) => setContent("header_title", e.target.value)}
                placeholder="🎉 בר מצווה"
                style={input()}
              />
              <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
                טיפ: אם תשאיר ריק, האתר יציג אוטומטית: 🎉 + סוג האירוע
              </div>
            </label>

            <label>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>תיאור מתחת לכותרת</div>
              <textarea
                value={value.content.header_subtitle}
                onChange={(e) => setContent("header_subtitle", e.target.value)}
                rows={3}
                style={textarea()}
              />
            </label>

            <label>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>כותרת טופס הברכה (H2)</div>
              <input
                value={value.content.form_title}
                onChange={(e) => setContent("form_title", e.target.value)}
                placeholder="אשמח לברכה מרגשת ממך"
                style={input()}
              />
            </label>
          </div>
        </section>
      )}
    </main>
  );
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    outline: "none",
  };
}

function textarea(): React.CSSProperties {
  return {
    ...input(),
    resize: "vertical",
  };
}

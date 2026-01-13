"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_UI: UISettings = {
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
};

export default function AdminUIPage() {
  const [ui, setUi] = useState<UISettings>(DEFAULT_UI);
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
      setUi(((j?.value?.ui as UISettings) || DEFAULT_UI));
    } catch (e: any) {
      setMsg(e?.message || "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setTheme<K extends keyof UISettings["theme"]>(key: K, value: string) {
    setUi((prev) => ({ ...prev, theme: { ...prev.theme, [key]: value } }));
  }

  function setButton<K extends keyof UISettings["buttons"]>(key: K, patch: Partial<UIButtonCfg>) {
    setUi((prev) => ({
      ...prev,
      buttons: {
        ...prev.buttons,
        [key]: { ...prev.buttons[key], ...patch },
      },
    }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: { ui: e } }),
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

  const buttonsList = useMemo(
    () =>
      [
        { key: "upload", title: "כפתור העלאת תמונה/וידאו" },
        { key: "camera", title: "כפתור צילום" },
        { key: "link", title: "כפתור צרף קישור" },
        { key: "remove", title: "כפתור הסר קובץ" },
        { key: "refresh", title: "כפתור רענון" },
      ] as const,
    []
  );

  return (
    <main style={{ padding: 18, direction: "rtl", maxWidth: 900, margin: "0 auto", color: "white" }}>
      <h1 style={{ marginTop: 0 }}>🎛️ ניהול עיצוב וכפתורים</h1>

      <AdminNav current="ui" />

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
        <div style={{ opacity: 0.8, marginTop: 14 }}>טוען…</div>
      ) : (
        <>
          <div style={card()}>
            <h2 style={{ marginTop: 0 }}>🎨 צבעים</h2>

            <div style={grid2()}>
              <label style={field()}>
                <div style={lab()}>צבע “שליחה”</div>
                <input type="color" value={ui.theme.send_color} onChange={(e) => setTheme("send_color", e.target.value)} />
              </label>

              <label style={field()}>
                <div style={lab()}>צבע ברירת מחדל (לשאר הכפתורים)</div>
                <input
                  type="color"
                  value={ui.theme.default_color}
                  onChange={(e) => setTheme("default_color", e.target.value)}
                />
              </label>

              <label style={field()}>
                <div style={lab()}>צבע “danger” (מחיקה/הסר)</div>
                <input
                  type="color"
                  value={ui.theme.danger_color}
                  onChange={(e) => setTheme("danger_color", e.target.value)}
                />
              </label>

              <label style={field()}>
                <div style={lab()}>צבע רקע</div>
                <input type="color" value={ui.theme.bg} onChange={(e) => setTheme("bg", e.target.value)} />
              </label>

              <label style={field()}>
                <div style={lab()}>רקע כרטיסים (card_bg)</div>
                <input
                  value={ui.theme.card_bg}
                  onChange={(e) => setTheme("card_bg", e.target.value)}
                  style={inp()}
                  placeholder='למשל: rgba(255,255,255,0.04)'
                />
              </label>
            </div>
          </div>

          <div style={card()}>
            <h2 style={{ marginTop: 0 }}>🧩 כפתורים (הצגה/הסתרה + טקסט)</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {buttonsList.map((b) => {
                const cfg = ui.buttons[b.key];
                return (
                  <div
                    key={b.key}
                    style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 12 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>{b.title}</div>

                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={cfg.show}
                          onChange={(e) => setButton(b.key, { show: e.target.checked })}
                        />
                        להציג
                      </label>
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                      <label style={field()}>
                        <div style={lab()}>טקסט הכפתור</div>
                        <input value={cfg.label} onChange={(e) => setButton(b.key, { label: e.target.value })} style={inp()} />
                      </label>

                      <label style={field()}>
                        <div style={lab()}>סוג צבע</div>
                        <select
                          value={cfg.color}
                          onChange={(e) => setButton(b.key, { color: e.target.value as any })}
                          style={inp()}
                        >
                          <option value="default">Default (ברירת מחדל)</option>
                          <option value="danger">Danger</option>
                          <option value="send">Send (ירוק)</option>
                        </select>
                      </label>

                      <label style={field()}>
                        <div style={lab()}>צבע מותאם אישית</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <input
                            type="color"
                            value={
                              cfg.custom_color ||
                              (cfg.color === "send"
                                ? ui.theme.send_color
                                : cfg.color === "danger"
                                ? ui.theme.danger_color
                                : ui.theme.default_color)
                            }
                            onChange={(e) => setButton(b.key, { custom_color: e.target.value })}
                          />
                          <input
                            value={cfg.custom_color || ""}
                            onChange={(e) => setButton(b.key, { custom_color: e.target.value ? e.target.value : null })}
                            style={inp()}
                            placeholder="#RRGGBB"
                          />
                          <button type="button" onClick={() => setButton(b.key, { custom_color: null })} style={btn("default")}>
                            אפס צבע
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
    marginTop: 14,
  };
}

function grid2(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };
}

function field(): React.CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 6 };
}

function lab(): React.CSSProperties {
  return { opacity: 0.9, fontWeight: 800, fontSize: 13 };
}

function inp(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "10px 12px",
    outline: "none",
  };
}

function btn(kind: "primary" | "default" = "default"): React.CSSProperties {
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
  return base;
}

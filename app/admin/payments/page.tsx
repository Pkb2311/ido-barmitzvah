"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { AdminNav } from "../AdminNav";

type PaymentsSettings = {
  enabled: boolean;
  bit_url: string;
  paybox_url: string;
  title?: string;
};

const DEFAULT_PAYMENTS: PaymentsSettings = {
  enabled: false,
  bit_url: "",
  paybox_url: "",
  title: "🎁 שליחת מתנה",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentsSettings>(DEFAULT_PAYMENTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toast(t: string) {
    setOk(t);
    window.setTimeout(() => setOk(null), 3000);
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" as any });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בטעינת הגדרות");

      const p = (j?.value?.payments && typeof j.value.payments === "object") ? j.value.payments : {};
      setPayments({
        enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_PAYMENTS.enabled,
        bit_url: typeof p.bit_url === "string" ? p.bit_url : DEFAULT_PAYMENTS.bit_url,
        paybox_url: typeof p.paybox_url === "string" ? p.paybox_url : DEFAULT_PAYMENTS.paybox_url,
        title: typeof p.title === "string" ? p.title : DEFAULT_PAYMENTS.title,
      });
    } catch (e: any) {
      setErr(e?.message || "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: { payments } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בשמירה");
      toast("נשמר ✅");
      await load();
    } catch (e: any) {
      setErr(e?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>ניהול תשלומים 💸</h1>
      <AdminNav current="payments" />

      {err ? <div style={styles.err}>{err}</div> : null}
      {ok ? <div style={styles.ok}>{ok}</div> : null}

      <div style={styles.card}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>טוען…</div>
        ) : (
          <>
            <label style={styles.row}>
              <input
                type="checkbox"
                checked={!!payments.enabled}
                onChange={(e) => setPayments((p) => ({ ...p, enabled: e.target.checked }))}
              />
              <div>
                <div style={{ fontWeight: 900 }}>להציג כפתורי תשלום בדף הראשי</div>
                <div style={{ opacity: 0.8, fontSize: 14 }}>Bit / PayBox (לפי מה שמוגדר כאן)</div>
              </div>
            </label>

            <div style={{ height: 12 }} />

            <label style={styles.field}>
              <div style={styles.label}>כותרת (אופציונלי)</div>
              <input
                value={payments.title || ""}
                onChange={(e) => setPayments((p) => ({ ...p, title: e.target.value }))}
                style={styles.input}
                placeholder='למשל: "🎁 רוצים לפרגן במתנה?"'
              />
            </label>

            <div style={{ height: 12 }} />

            <label style={styles.field}>
              <div style={styles.label}>קישור Bit</div>
              <input
                value={payments.bit_url}
                onChange={(e) => setPayments((p) => ({ ...p, bit_url: e.target.value }))}
                style={styles.input}
                placeholder="https://..."
              />
            </label>

            <div style={{ height: 12 }} />

            <label style={styles.field}>
              <div style={styles.label}>קישור PayBox</div>
              <input
                value={payments.paybox_url}
                onChange={(e) => setPayments((p) => ({ ...p, paybox_url: e.target.value }))}
                style={styles.input}
                placeholder="https://..."
              />
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={load} style={btn("default")} disabled={saving}>
                רענון
              </button>
              <button onClick={save} style={btn("primary")} disabled={saving}>
                {saving ? "שומר…" : "שמירה"}
              </button>
            </div>

            <div style={{ marginTop: 14, opacity: 0.8, fontSize: 13, lineHeight: 1.5 }}>
              טיפ: אפשר להשאיר אחד ריק — ואז יוצג רק הכפתור שיש לו קישור.
            </div>
          </>
        )}
      </div>
    </div>
  );
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

  if (kind === "primary") return { ...base, background: "rgba(46, 204, 113, 0.20)", borderColor: "rgba(46, 204, 113, 0.45)" };
  return base;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b1020",
    color: "white",
    direction: "rtl",
    padding: 18,
    maxWidth: 1000,
    margin: "0 auto",
  },
  h1: { margin: 0, fontSize: 28, fontWeight: 900 },
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
  },
  row: { display: "flex", gap: 10, alignItems: "flex-start" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 14, opacity: 0.9, fontWeight: 900 },
  input: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "11px 11px",
    outline: "none",
  },
  err: {
    background: "rgba(231, 76, 60, 0.20)",
    border: "1px solid rgba(231, 76, 60, 0.45)",
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  ok: {
    background: "rgba(0,0,0,0.75)",
    border: "1px solid rgba(255,255,255,0.18)",
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 12,
  },
};

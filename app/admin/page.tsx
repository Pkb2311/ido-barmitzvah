"use client";

import { useEffect, useMemo, useState } from "react";

type PostRow = {
  id: string;
  created_at: string;
  name: string;
  message: string;
  media_url: string | null;
  media_type: string | null; // "image" | "video" | null
  link_url: string | null;
  approved: boolean;
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("he-IL");
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [pending, setPending] = useState<PostRow[]>([]);
  const [approved, setApproved] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [p, a] = await Promise.all([
        fetch("/api/admin/posts?status=pending", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/posts?status=approved", { cache: "no-store" }).then((r) => r.json()),
      ]);

      if (p?.error) throw new Error(p.error);
      if (a?.error) throw new Error(a.error);

      setPending(p.data || []);
      setApproved(a.data || []);
    } catch (e: any) {
      setErr(e?.message || "שגיאה בטעינת נתונים");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function setApprove(id: string, value: boolean) {
    setErr(null);
    const res = await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved: value }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j?.error || "שגיאה בעדכון אישור");
      return;
    }
    await loadAll();
  }

  async function deletePost(id: string) {
    if (!confirm("למחוק את הברכה?")) return;
    setErr(null);
    const res = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j?.error || "שגיאה במחיקה");
      return;
    }
    await loadAll();
  }

  const stats = useMemo(
    () => ({ pending: pending.length, approved: approved.length }),
    [pending.length, approved.length]
  );

  return (
    <div style={{ padding: 20, direction: "rtl", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>🔐 אזור ניהול</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        ממתינים: <b>{stats.pending}</b> · מאושרים: <b>{stats.approved}</b>
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button onClick={loadAll} style={btn()}>
          רענון
        </button>
      </div>

      {err && (
        <div
          style={{
            background: "#4b1f1f",
            color: "white",
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ opacity: 0.8 }}>טוען נתונים…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Section
            title={`ממתינים לאישור (${pending.length})`}
            rows={pending}
            primaryActionLabel="אשר"
            onPrimaryAction={(id) => setApprove(id, true)}
            secondaryActionLabel="מחק"
            onSecondaryAction={(id) => deletePost(id)}
          />

          <Section
            title={`מאושרים (${approved.length})`}
            rows={approved}
            primaryActionLabel="בטל אישור"
            onPrimaryAction={(id) => setApprove(id, false)}
            secondaryActionLabel="מחק"
            onSecondaryAction={(id) => deletePost(id)}
          />
        </div>
      )}
    </div>
  );
}

function Section(props: {
  title: string;
  rows: PostRow[];
  primaryActionLabel: string;
  onPrimaryAction: (id: string) => void;
  secondaryActionLabel: string;
  onSecondaryAction: (id: string) => void;
}) {
  const { title, rows, primaryActionLabel, onPrimaryAction, secondaryActionLabel, onSecondaryAction } = props;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 14 }}>
      <h2 style={{ marginTop: 0, marginBottom: 10 }}>{title}</h2>

      {rows.length === 0 ? (
        <div style={{ opacity: 0.7 }}>אין רשומות כאן.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{r.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(r.created_at)}</div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onPrimaryAction(r.id)} style={btn("primary")}>
                    {primaryActionLabel}
                  </button>
                  <button onClick={() => onSecondaryAction(r.id)} style={btn("danger")}>
                    {secondaryActionLabel}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{r.message}</div>

              {r.link_url && (
                <div style={{ marginTop: 10 }}>
                  🔗{" "}
                  <a href={r.link_url} target="_blank" rel="noreferrer">
                    {r.link_url}
                  </a>
                </div>
              )}

              {r.media_url && (
                <div style={{ marginTop: 10 }}>
                  {r.media_type === "video" ? (
                    <video src={r.media_url} controls style={{ width: "100%", borderRadius: 12 }} />
                  ) : (
                    <img src={r.media_url} alt="" style={{ width: "100%", borderRadius: 12 }} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn(kind: "primary" | "danger" | "default" = "default") {
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "

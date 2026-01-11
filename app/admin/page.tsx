"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "./AdminNav";

type PostRow = {
  id: string;
  created_at: string;
  name: string;
  message: string;
  media_url: string | null;
  media_type: string | null;
  link_url: string | null;
  approved: boolean;
};

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

type SiteSettings = {
  require_approval: boolean;
  ui: UISettings;
};

const DEFAULT_SETTINGS: SiteSettings = {
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
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // עריכה ע"י מנהל
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editLink, setEditLink] = useState("");

  function showToast(txt: string) {
    setToast(txt);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function loadPosts() {
    setLoadingPosts(true);
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
      setErr(e?.message || "שגיאה בטעינת ברכות");
    } finally {
      setLoadingPosts(false);
    }
  }

  async function loadSettings() {
    setLoadingSettings(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בטעינת הגדרות");

      const value = j?.value || {};
      setSettings({
        require_approval: value?.require_approval ?? DEFAULT_SETTINGS.require_approval,
        ui: value?.ui ?? DEFAULT_SETTINGS.ui,
      });
    } catch (e: any) {
      setErr(e?.message || "שגיאה בטעינת הגדרות");
    } finally {
      setLoadingSettings(false);
    }
  }

  useEffect(() => {
    loadPosts();
    loadSettings();
  }, []);

  async function setApprove(id: string, value: boolean) {
    setErr(null);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved: value }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בעדכון אישור");

      showToast(value ? "אושר ✅" : "בוטל אישור ✅");
      await loadPosts();
    } catch (e: any) {
      setErr(e?.message || "שגיאה בעדכון אישור");
    }
  }

  function startEdit(row: PostRow) {
    setEditingId(row.id);
    setEditName(row.name || "");
    setEditMessage(row.message || "");
    setEditLink(row.link_url || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditMessage("");
    setEditLink("");
  }

  async function saveEdit() {
    if (!editingId) return;
    const nextName = editName.trim();
    const msg = editMessage.trim();
    const link = editLink.trim();

    if (!nextName) {
      setErr("השם לא יכול להיות ריק");
      return;
    }

    if (!msg) {
      setErr("הברכה לא יכולה להיות ריקה");
      return;
    }
    if (link && !/^https?:\/\//i.test(link)) {
      setErr("הלינק חייב להתחיל ב-http/https");
      return;
    }

    setErr(null);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: nextName, message: msg, link_url: link }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בעדכון");

      showToast("עודכן ✅");
      cancelEdit();
      await loadPosts();
    } catch (e: any) {
      setErr(e?.message || "שגיאה בעדכון");
    }
  }

  async function deletePost(id: string) {
    const ok = window.confirm("למחוק את הברכה? זה בלתי הפיך.");
    if (!ok) return;

    setErr(null);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה במחיקה");

      showToast("נמחק ✅");
      await loadPosts();
    } catch (e: any) {
      setErr(e?.message || "שגיאה במחיקה");
    }
  }

  async function saveSettings() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: settings }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בשמירת הגדרות");

      showToast("הגדרות נשמרו ✅");
      await loadSettings();
    } catch (e: any) {
      setErr(e?.message || "שגיאה בשמירת הגדרות");
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(
    () => ({ pending: pending.length, approved: approved.length }),
    [pending.length, approved.length]
  );

  const ui = settings.ui;

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>ניהול</h1>
      <AdminNav current="posts" />
      <p style={styles.sub}>
        ממתינים: <b>{stats.pending}</b> · מאושרים: <b>{stats.approved}</b>
      </p>

      {err ? <div style={styles.err}>{err}</div> : null}
      {toast ? <div style={styles.toast}>{toast}</div> : null}

      <div style={styles.grid2}>
        {/* הגדרות */}
        <div style={styles.card}>
          <h2 style={styles.h2}>הגדרות אתר</h2>

          {loadingSettings ? (
            <div style={{ opacity: 0.8 }}>טוען הגדרות…</div>
          ) : (
            <>
              <label style={styles.row}>
                <input
                  type="checkbox"
                  checked={!!settings.require_approval}
                  onChange={(e) => setSettings((s) => ({ ...s, require_approval: e.target.checked }))}
                />
                <div>
                  <div style={{ fontWeight: 900 }}>דורש אישור מנהל לפני פרסום</div>
                  <div style={{ opacity: 0.8, fontSize: 14 }}>
                    אם מסומן: ברכות נכנסות ל״ממתינים״ ורק אחרי אישור יופיעו באתר
                  </div>
                </div>
              </label>

              <div style={{ height: 12 }} />

              <h3 style={styles.h3}>צבעים</h3>
              <div style={styles.colorsGrid}>
                <label style={styles.field}>
                  <div style={styles.label}>צבע שליחה (ירוק)</div>
                  <input
                    type="color"
                    value={ui.theme.send_color}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, ui: { ...s.ui, theme: { ...s.ui.theme, send_color: e.target.value } } }))
                    }
                  />
                </label>

                <label style={styles.field}>
                  <div style={styles.label}>צבע כפתורים רגילים</div>
                  <input
                    type="color"
                    value={ui.theme.default_color}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        ui: { ...s.ui, theme: { ...s.ui.theme, default_color: e.target.value } },
                      }))
                    }
                  />
                </label>

                <label style={styles.field}>
                  <div style={styles.label}>צבע danger (מחיקה/הסר)</div>
                  <input
                    type="color"
                    value={ui.theme.danger_color}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        ui: { ...s.ui, theme: { ...s.ui.theme, danger_color: e.target.value } },
                      }))
                    }
                  />
                </label>

                <label style={styles.field}>
                  <div style={styles.label}>צבע רקע</div>
                  <input
                    type="color"
                    value={ui.theme.bg}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        ui: { ...s.ui, theme: { ...s.ui.theme, bg: e.target.value } },
                      }))
                    }
                  />
                </label>

                <label style={styles.field}>
                  <div style={styles.label}>רקע כרטיסים (card_bg)</div>
                  <input
                    value={ui.theme.card_bg}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        ui: { ...s.ui, theme: { ...s.ui.theme, card_bg: e.target.value } },
                      }))
                    }
                    style={styles.smallInput}
                    placeholder='למשל: rgba(255,255,255,0.04)'
                  />
                </label>
              </div>

              <div style={{ height: 14 }} />

              <h3 style={styles.h3}>כפתורים (הצגה/טקסט/סוג צבע)</h3>

              <ButtonsEditor
                buttons={ui.buttons}
                onChange={(next) => setSettings((s) => ({ ...s, ui: { ...s.ui, buttons: next } }))}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button style={btn("default")} onClick={loadSettings} disabled={saving}>
                  רענון הגדרות
                </button>
                <button style={btn("primary")} onClick={saveSettings} disabled={saving}>
                  {saving ? "שומר…" : "שמירה"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ברכות */}
        <div style={styles.card}>
          <h2 style={styles.h2}>ברכות</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button style={btn("default")} onClick={loadPosts} disabled={loadingPosts}>
              רענון רשימות
            </button>
          </div>

          {loadingPosts ? (
            <div style={{ opacity: 0.8 }}>טוען ברכות…</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <Section
                title={`ממתינים לאישור (${pending.length})`}
                rows={pending}
                primaryActionLabel="אשר"
                onPrimaryAction={(id) => setApprove(id, true)}
                secondaryActionLabel="מחק"
                onSecondaryAction={(id) => deletePost(id)}
                onEdit={startEdit}
                editingId={editingId}
                editMessage={editMessage}
                editLink={editLink}
                setEditMessage={setEditMessage}
                setEditLink={setEditLink}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
              />

              <Section
                title={`מאושרים (${approved.length})`}
                rows={approved}
                primaryActionLabel="בטל אישור"
                onPrimaryAction={(id) => setApprove(id, false)}
                secondaryActionLabel="מחק"
                onSecondaryAction={(id) => deletePost(id)}
                onEdit={startEdit}
                editingId={editingId}
                editMessage={editMessage}
                editLink={editLink}
                setEditMessage={setEditMessage}
                setEditLink={setEditLink}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ButtonsEditor(props: {
  buttons: SiteSettings["ui"]["buttons"];
  onChange: (next: SiteSettings["ui"]["buttons"]) => void;
}) {
  const { buttons, onChange } = props;

  function setBtn<K extends keyof typeof buttons>(key: K, patch: Partial<(typeof buttons)[K]>) {
    onChange({ ...buttons, [key]: { ...buttons[key], ...patch } });
  }

  const rows: Array<{ key: keyof typeof buttons; title: string }> = [
    { key: "upload", title: "כפתור העלאה" },
    { key: "camera", title: "כפתור מצלמה" },
    { key: "link", title: "כפתור קישור" },
    { key: "remove", title: "כפתור הסרת קובץ" },
    { key: "refresh", title: "כפתור רענון" },
  ];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.key} style={styles.btnRow}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!buttons[r.key].show}
              onChange={(e) => setBtn(r.key, { show: e.target.checked })}
            />
            <b>{r.title}</b>
          </label>

          <input
            value={buttons[r.key].label}
            onChange={(e) => setBtn(r.key, { label: e.target.value })}
            style={styles.smallInput}
            placeholder="טקסט כפתור"
          />

          <select
            value={buttons[r.key].color}
            onChange={(e) => setBtn(r.key, { color: e.target.value as any })}
            style={styles.smallSelect}
          >
            <option value="default">default</option>
            <option value="danger">danger</option>
            <option value="send">send</option>
          </select>
        </div>
      ))}
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
  onEdit: (row: PostRow) => void;
  editingId: string | null;
  editMessage: string;
  editLink: string;
  setEditMessage: (v: string) => void;
  setEditLink: (v: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}) {
  const {
    title,
    rows,
    primaryActionLabel,
    onPrimaryAction,
    secondaryActionLabel,
    onSecondaryAction,
    onEdit,
    editingId,
    editMessage,
    editLink,
    setEditMessage,
    setEditLink,
    onCancelEdit,
    onSaveEdit,
  } = props;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
      <h3 style={{ margin: "0 0 10px 0" }}>{title}</h3>

      {rows.length === 0 ? (
        <div style={{ opacity: 0.7 }}>אין רשומות כאן.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={styles.postBox}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{r.name}</div>
                  <div style={{ fontSize: 14, opacity: 0.75 }}>{formatDate(r.created_at)}</div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {editingId === r.id ? (
                    <>
                      <button onClick={onSaveEdit} style={btn("primary")}>
                        שמור עריכה
                      </button>
                      <button onClick={onCancelEdit} style={btn("default")}>
                        ביטול
                      </button>
                    </>
                  ) : (
                    <button onClick={() => onEdit(r)} style={btn("default")}>
                      עריכה
                    </button>
                  )}
                  <button onClick={() => onPrimaryAction(r.id)} style={btn("primary")}>
                    {primaryActionLabel}
                  </button>
                  <button onClick={() => onSecondaryAction(r.id)} style={btn("danger")}>
                    {secondaryActionLabel}
                  </button>
                </div>
              </div>

              {editingId === r.id ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <label style={styles.field}>
                    <div style={styles.label}>שם</div>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={styles.smallInput} />
                  </label>

                  <label style={styles.field}>
                    <div style={styles.label}>ברכה</div>
                    <textarea
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      rows={5}
                      style={{ ...styles.smallInput, minHeight: 120, resize: "vertical" as const }}
                    />
                  </label>

                  <label style={styles.field}>
                    <div style={styles.label}>קישור (אופציונלי)</div>
                    <input
                      value={editLink}
                      onChange={(e) => setEditLink(e.target.value)}
                      style={styles.smallInput}
                      placeholder="https://..."
                    />
                  </label>
                </div>
              ) : (
                <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{r.message}</div>
              )}

              {editingId !== r.id && r.link_url ? (
                <div style={{ marginTop: 10 }}>
                  🔗{" "}
                  <a href={r.link_url} target="_blank" rel="noreferrer" style={{ color: "white" }}>
                    {r.link_url}
                  </a>
                </div>
              ) : null}

              {r.media_url ? (
                <div style={{ marginTop: 10 }}>
                  {r.media_type === "video" ? (
                    <video src={r.media_url} controls style={{ width: "100%", borderRadius: 12 }} />
                  ) : (
                    <img src={r.media_url} alt="" style={{ width: "100%", borderRadius: 12 }} />
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn(kind: "primary" | "danger" | "default" = "default"): React.CSSProperties {
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
  if (kind === "danger") return { ...base, background: "rgba(231, 76, 60, 0.18)", borderColor: "rgba(231, 76, 60, 0.45)" };
  return base;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b1020",
    color: "white",
    direction: "rtl",
    padding: 18,
    maxWidth: 1200,
    margin: "0 auto",
  },
  h1: { margin: 0, fontSize: 30, fontWeight: 900 },
  sub: { marginTop: 8, opacity: 0.85 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 },
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
  },
  h2: { margin: "0 0 12px 0", fontSize: 18, fontWeight: 900 },
  h3: { margin: "0 0 10px 0", fontSize: 15, fontWeight: 900, opacity: 0.95 },
  err: { background: "rgba(231, 76, 60, 0.20)", border: "1px solid rgba(231, 76, 60, 0.45)", padding: 10, borderRadius: 12, marginTop: 12 },
  toast: { background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.18)", padding: 10, borderRadius: 12, marginTop: 12 },
  row: { display: "flex", gap: 10, alignItems: "flex-start" },
  colorsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 14, opacity: 0.9, fontWeight: 900 },
  btnRow: {
    display: "grid",
    gridTemplateColumns: "180px 1fr 120px",
    gap: 10,
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 10,
  },
  smallInput: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "11px 11px",
    outline: "none",
  },
  smallSelect: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "11px 11px",
    outline: "none",
  },
  postBox: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 12,
  },
};

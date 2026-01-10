"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type PostRow = {
  id: string;
  created_at: string;
  name: string;
  message: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  link_url: string | null;
  editable_until?: string | null;
};

const OWNER_KEY = "ido_owner_token_v1";
const EDIT_WINDOW_MS = 60 * 60 * 1000;

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("he-IL");
  } catch {
    return iso;
  }
}

function getOrCreateOwnerToken() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(OWNER_KEY);
  if (existing) return existing;
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(OWNER_KEY, token);
  return token;
}

function canEditNow(editable_until?: string | null) {
  if (!editable_until) return false;
  const t = new Date(editable_until).getTime();
  return Date.now() <= t;
}

export default function HomePage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pickFileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const [ownerToken, setOwnerToken] = useState("");

  // מצב עריכה
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editRemoveMedia, setEditRemoveMedia] = useState(false);

  useEffect(() => {
    setOwnerToken(getOrCreateOwnerToken());
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(txt: string) {
    setToast(txt);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const res = await fetch("/api/posts", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בטעינה");
      setPosts(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) {
      showToast(e?.message || "שגיאה בטעינת ברכות");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  function onSelectFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!name.trim() || !message.trim()) {
      showToast("חובה למלא שם וברכה");
      return;
    }

    const finalLink = showLink ? linkUrl.trim() : "";
    if (finalLink && !/^https?:\/\//i.test(finalLink)) {
      showToast("הלינק חייב להתחיל ב-http/https");
      return;
    }

    if (!ownerToken) {
      showToast("שגיאה: אין owner token (רענן דף)");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("message", message.trim());
      if (finalLink) form.append("link_url", finalLink);
      if (file) form.append("media", file);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "x-owner-token": ownerToken,
        },
        body: form,
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בשליחה");

      if (j?.approved === false) {
        showToast("נשלח בהצלחה ✅ מחכה לאישור מנהל");
      } else {
        showToast("נשלח בהצלחה ✅");
      }

      setName("");
      setMessage("");
      setShowLink(false);
      setLinkUrl("");
      onSelectFile(null);

      await loadPosts();
    } catch (e: any) {
      showToast(e?.message || "שגיאה בשליחה");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(p: PostRow) {
    // חשוב: אנחנו לא יודעים בוודאות שהוא "בעלים" כי אנחנו לא מחזירים owner_token מהשרת.
    // לכן הכפתורים מוצגים לפי editable_until בלבד, והשרת יאשר/יחסום לפי token בפועל.
    setEditingId(p.id);
    setEditMessage(p.message || "");
    setEditLinkUrl(p.link_url || "");
    setEditRemoveMedia(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMessage("");
    setEditLinkUrl("");
    setEditRemoveMedia(false);
  }

  async function saveEdit(id: string) {
    if (!ownerToken) {
      showToast("שגיאה: אין owner token");
      return;
    }
    if (!editMessage.trim()) {
      showToast("אי אפשר להשאיר ברכה ריקה");
      return;
    }
    if (editLinkUrl.trim() && !/^https?:\/\//i.test(editLinkUrl.trim())) {
      showToast("הלינק חייב להתחיל ב-http/https");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-owner-token": ownerToken,
        },
        body: JSON.stringify({
          id,
          message: editMessage.trim(),
          link_url: editLinkUrl.trim(),
          remove_media: editRemoveMedia,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בעריכה");

      showToast("עודכן ✅");
      cancelEdit();
      await loadPosts();
    } catch (e: any) {
      showToast(e?.message || "שגיאה בעריכה");
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost(id: string) {
    if (!confirm("למחוק את הברכה?")) return;
    if (!ownerToken) {
      showToast("שגיאה: אין owner token");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-owner-token": ownerToken,
        },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה במחיקה");

      showToast("נמחק ✅");
      cancelEdit();
      await loadPosts();
    } catch (e: any) {
      showToast(e?.message || "שגיאה במחיקה");
    } finally {
      setSubmitting(false);
    }
  }

  const count = useMemo(() => posts.length, [posts.length]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h1 style={styles.h1}>בר מצווה 🎉</h1>
            <div style={styles.badge}>ברכות מאושרות: {count}</div>
          </div>
          <p style={styles.sub}>כתבו ברכה לעידו, אפשר גם לצרף תמונה/וידאו או קישור. במובייל תוכלו גם לצלם ישר מהדף.</p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.h2}>השארת ברכה</h2>

          <div style={styles.grid}>
            <label style={styles.field}>
              <div style={styles.label}>שם</div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: פרי" style={styles.input} />
            </label>

            <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
              <div style={styles.label}>ברכה</div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="כתבו משהו מרגש 🙂"
                style={styles.textarea}
                rows={5}
              />
            </label>

            {/* קישור מתחת לשדה ברכה, ורק אם הופעל */}
            {showLink ? (
              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <div style={styles.label}>קישור (אופציונלי)</div>
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." style={styles.input} />
              </label>
            ) : null}
          </div>

          {/* כפתורים מותאמים למובייל: אחידים ורוחב מלא */}
          <div style={styles.actions}>
            <button type="button" onClick={() => pickFileRef.current?.click()} style={styles.btnFull} disabled={submitting}>
              העלאת תמונה/וידאו
            </button>

            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              style={{ ...styles.btnFull, ...styles.btnGreen }}
              disabled={submitting}
              title="במובייל זה יפתח את המצלמה"
            >
              📸 צילום תמונה
            </button>

            <button
              type="button"
              onClick={() => setShowLink((v) => !v)}
              style={styles.btnFull}
              disabled={submitting}
            >
              {showLink ? "הסר קישור" : "צרף קישור"}
            </button>

            {file ? (
              <button type="button" onClick={() => onSelectFile(null)} style={{ ...styles.btnFull, ...styles.btnRed }} disabled={submitting}>
                הסר קובץ
              </button>
            ) : null}

            <button type="button" onClick={submit} style={{ ...styles.btnFull, ...styles.btnGreen }} disabled={submitting}>
              {submitting ? "שולח…" : "שליחה"}
            </button>

            <button type="button" onClick={loadPosts} style={styles.btnFull} disabled={loading || submitting}>
              רענון
            </button>

            {/* קלט רגיל (קבצים) */}
            <input
              ref={pickFileRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
            />

            {/* קלט מצלמה */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {previewUrl ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>תצוגה מקדימה:</div>
              {file?.type?.startsWith("video/") ? <video src={previewUrl} controls style={styles.media} /> : <img src={previewUrl} alt="" style={styles.media} />}
            </div>
          ) : null}
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>ברכות מאושרות</h2>

          {loading ? (
            <div style={{ opacity: 0.8 }}>טוען…</div>
          ) : posts.length === 0 ? (
            <div style={{ opacity: 0.8 }}>עדיין אין ברכות מאושרות.</div>
          ) : (
            <div style={styles.list}>
              {posts.map((p) => {
                const editable = canEditNow(p.editable_until || null);
                const isEditing = editingId === p.id;

                return (
                  <article key={p.id} style={styles.postCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{formatDate(p.created_at)}</div>
                      </div>

                      {/* פעולות למי ששלח - לשעה בלבד (השרת יאמת לפי token) */}
                      {editable ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" onClick={() => startEdit(p)} style={miniBtn()}>
                            ✏️ עריכה
                          </button>
                          <button type="button" onClick={() => deletePost(p.id)} style={miniBtn("danger")}>
                            🗑️ מחיקה
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          אפשר לערוך/למחוק עד שעה אחרי השליחה. אם ייחסם – זה בגלל שפג הזמן או שזה לא אותו מכשיר.
                        </div>

                        <textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          style={styles.textarea}
                          rows={4}
                        />

                        <input
                          value={editLinkUrl}
                          onChange={(e) => setEditLinkUrl(e.target.value)}
                          placeholder="https://..."
                          style={styles.input}
                        />

                        {p.media_url ? (
                          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, opacity: 0.95 }}>
                            <input
                              type="checkbox"
                              checked={editRemoveMedia}
                              onChange={(e) => setEditRemoveMedia(e.target.checked)}
                            />
                            להסיר מדיה מהברכה (תמונה/וידאו)
                          </label>
                        ) : null}

                        <div style={{ display: "flex", gap: 10 }}>
                          <button type="button" onClick={() => saveEdit(p.id)} style={miniBtn("primary")} disabled={submitting}>
                            שמירה ✅
                          </button>
                          <button type="button" onClick={cancelEdit} style={miniBtn()} disabled={submitting}>
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{p.message}</div>

                        {p.link_url ? (
                          <div style={{ marginTop: 10 }}>
                            🔗{" "}
                            <a href={p.link_url} target="_blank" rel="noreferrer" style={{ color: "white" }}>
                              {p.link_url}
                            </a>
                          </div>
                        ) : null}

                        {p.media_url ? (
                          <div style={{ marginTop: 12 }}>
                            {p.media_type === "video" ? (
                              <video src={p.media_url} controls style={styles.media} />
                            ) : (
                              <img src={p.media_url} alt="" style={styles.media} />
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {toast ? <div style={styles.toast}>{toast}</div> : null}
    </main>
  );
}

function miniBtn(kind: "primary" | "danger" | "default" = "default"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  };
  if (kind === "primary") return { ...base, background: "rgba(46, 204, 113, 0.22)", borderColor: "rgba(46, 204, 113, 0.45)" };
  if (kind === "danger") return { ...base, background: "rgba(231, 76, 60, 0.20)", borderColor: "rgba(231, 76, 60, 0.45)" };
  return base;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(900px 600px at 50% -10%, rgba(120,170,255,0.25), transparent 70%), #0b1020",
    color: "white",
    direction: "rtl",
    padding: 14,
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  header: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
  },
  h1: { margin: 0, fontSize: 28, letterSpacing: 0.2 },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    opacity: 0.95,
  },
  sub: { margin: "8px 0 0 0", opacity: 0.85, lineHeight: 1.5 },
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
  },
  h2: { margin: "0 0 12px 0", fontSize: 18 },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { opacity: 0.85, fontSize: 13 },
  input: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "12px 12px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "12px 12px",
    outline: "none",
    resize: "vertical",
  },

  actions: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
  },
  btnFull: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnGreen: {
    background: "rgba(46, 204, 113, 0.22)",
    borderColor: "rgba(46, 204, 113, 0.45)",
  },
  btnRed: {
    background: "rgba(231, 76, 60, 0.20)",
    borderColor: "rgba(231, 76, 60, 0.45)",
  },

  list: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  postCard: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  media: { width: "100%", borderRadius: 14, display: "block" },
  toast: {
    position: "fixed",
    left: 16,
    right: 16,
    bottom: 16,
    margin: "0 auto",
    maxWidth: 520,
    background: "rgba(0,0,0,0.75)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "white",
    padding: "12px 14px",
    borderRadius: 14,
    textAlign: "center",
    zIndex: 50,
    backdropFilter: "blur(8px)",
  },
};

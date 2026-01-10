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
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("he-IL");
  } catch {
    return iso;
  }
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

    const link = linkUrl.trim();

    if (showLink && link && !/^https?:\/\//i.test(link)) {
      showToast("הלינק חייב להתחיל ב-http/https");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("message", message.trim());

      if (showLink && link) form.append("link_url", link);
      if (file) form.append("media", file);

      const res = await fetch("/api/posts", {
        method: "POST",
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
      setLinkUrl("");
      setShowLink(false);
      onSelectFile(null);

      await loadPosts();
    } catch (e: any) {
      showToast(e?.message || "שגיאה בשליחה");
    } finally {
      setSubmitting(false);
    }
  }

  const count = useMemo(() => posts.length, [posts.length]);

  const disableActions = submitting;
  const canSubmit = !submitting;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h1 style={styles.h1}>בר מצווה 🎉</h1>
            <div style={styles.badge}>ברכות מאושרות: {count}</div>
          </div>
          <p style={styles.sub}>
            כתבו ברכה לעידו. אפשר לצרף תמונה/וידאו או קישור. במובייל תוכלו גם לצלם ישר מהדף.
          </p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.h2}>השארת ברכה</h2>

          <div style={styles.formStack}>
            <label style={styles.field}>
              <div style={styles.label}>שם</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: פרי"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <div style={styles.label}>ברכה</div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="כתבו משהו מרגש 🙂"
                style={styles.textarea}
                rows={5}
              />
            </label>

            {showLink ? (
              <label style={styles.field}>
                <div style={styles.label}>קישור (אופציונלי)</div>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  style={styles.input}
                  inputMode="url"
                />
                <div style={styles.helperRow}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLink(false);
                      setLinkUrl("");
                    }}
                    style={btn("ghost")}
                    disabled={disableActions}
                  >
                    הסר קישור
                  </button>
                </div>
              </label>
            ) : null}
          </div>

          {/* כפתורים מסודרים 2×2, אחידים */}
          <div style={styles.actionsGrid}>
            <button
              type="button"
              onClick={() => pickFileRef.current?.click()}
              style={btn("default")}
              disabled={disableActions}
            >
              העלאת תמונה/וידאו
            </button>

            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              style={btn("primary")}
              disabled={disableActions}
              title="במובייל זה יפתח את המצלמה"
            >
              צילום תמונה 📸
            </button>

            <button
              type="button"
              onClick={() => setShowLink((v) => !v)}
              style={showLink ? btn("primary") : btn("default")}
              disabled={disableActions}
              title="הוספת קישור אופציונלי"
            >
              {showLink ? "קישור פתוח ✅" : "צרף קישור 🔗"}
            </button>

            <button type="button" onClick={loadPosts} style={btn("default")} disabled={loading || disableActions}>
              רענון
            </button>
          </div>

          {/* שליחה לבד - רוחב מלא */}
          <button
            type="button"
            onClick={submit}
            style={canSubmit ? btn("submit") : btn("disabled")}
            disabled={!canSubmit}
          >
            {submitting ? "שולח…" : "שליחה"}
          </button>

          {file ? (
            <div style={styles.fileRow}>
              <div style={{ opacity: 0.9, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                מצורף: <b>{file.name}</b>
              </div>
              <button type="button" onClick={() => onSelectFile(null)} style={btn("danger")} disabled={disableActions}>
                הסר קובץ
              </button>
            </div>
          ) : null}

          {/* קלט רגיל (קבצים) */}
          <input
            ref={pickFileRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />

          {/* קלט מצלמה (ברוב המוביילים יפתח מצלמה) */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />

          {previewUrl ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>תצוגה מקדימה:</div>
              {file?.type?.startsWith("video/") ? (
                <video src={previewUrl} controls style={styles.media} />
              ) : (
                <img src={previewUrl} alt="" style={styles.media} />
              )}
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
              {posts.map((p) => (
                <article key={p.id} style={styles.postCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{formatDate(p.created_at)}</div>
                    </div>
                  </div>

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
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast ? <div style={styles.toast}>{toast}</div> : null}
    </main>
  );
}

function btn(
  kind: "primary" | "danger" | "default" | "disabled" | "submit" | "ghost" = "default"
): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 48,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    userSelect: "none",
  };

  if (kind === "primary") {
    return { ...base, background: "rgba(46, 204, 113, 0.22)", borderColor: "rgba(46, 204, 113, 0.45)" };
  }
  if (kind === "danger") {
    return { ...base, background: "rgba(231, 76, 60, 0.20)", borderColor: "rgba(231, 76, 60, 0.45)" };
  }
  if (kind === "disabled") {
    return { ...base, opacity: 0.45, cursor: "not-allowed" };
  }
  if (kind === "submit") {
    return {
      ...base,
      height: 54,
      borderRadius: 16,
      background: "rgba(46, 204, 113, 0.35)",
      borderColor: "rgba(46, 204, 113, 0.65)",
      marginTop: 14,
      fontSize: 16,
    };
  }
  if (kind === "ghost") {
    return {
      ...base,
      height: 42,
      width: "auto",
      padding: "0 12px",
      background: "transparent",
      border: "1px solid rgba(255,255,255,0.16)",
      opacity: 0.9,
    };
  }
  return base;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 600px at 50% -10%, rgba(120,170,255,0.25), transparent 70%), #0b1020",
    color: "white",
    direction: "rtl",
    padding: 16,
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
  },
  h1: {
    margin: 0,
    fontSize: 28,
    letterSpacing: 0.2,
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    opacity: 0.95,
  },
  sub: {
    margin: "8px 0 0 0",
    opacity: 0.85,
    lineHeight: 1.55,
  },
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
  },
  h2: {
    margin: "0 0 12px 0",
    fontSize: 18,
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    opacity: 0.85,
    fontSize: 13,
  },
  helperRow: {
    marginTop: 8,
    display: "flex",
    justifyContent: "flex-start",
  },
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
  actionsGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  fileRow: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.22)",
    borderRadius: 14,
    padding: "10px 12px",
  },
  list: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
  },
  postCard: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  media: {
    width: "100%",
    borderRadius: 14,
    display: "block",
  },
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

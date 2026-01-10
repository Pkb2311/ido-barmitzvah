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

    if (showLink && linkUrl.trim() && !/^https?:\/\//i.test(linkUrl.trim())) {
      showToast("הלינק חייב להתחיל ב-http/https");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("message", message.trim());
      if (showLink && linkUrl.trim()) form.append("link_url", linkUrl.trim());
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

  const count = useMemo(() => posts.length, [posts.length]);

  const linkButtonText = showLink ? "הסר קישור" : "צרף קישור";

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <h1 style={styles.h1}>בר מצווה ✅✅</h1>
            <div style={styles.badge}>ברכות מאושרות: {count}</div>
          </div>

          <p style={styles.sub}>
            כתבו ברכה לעידו. אפשר לצרף תמונה/וידאו או קישור. במובייל תוכלו גם לצלם ישר מהדף.
          </p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.h2}>השארת ברכה</h2>

          <div style={styles.form}>
            <label style={styles.field}>
              <div style={styles.label}>שם</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: פרי"
                style={styles.input}
                inputMode="text"
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
              </label>
            ) : null}

            {/* כפתורי פעולה - מובייל פירסט */}
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                style={buttonStyle("secondary")}
                disabled={submitting}
                title="במובייל זה יפתח מצלמה"
              >
                📸 צילום תמונה
              </button>

              <button
                type="button"
                onClick={() => pickFileRef.current?.click()}
                style={buttonStyle("secondary")}
                disabled={submitting}
              >
                🖼 העלאת תמונה/וידאו
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLink((v) => !v);
                  if (showLink) setLinkUrl("");
                }}
                style={buttonStyle("secondary")}
                disabled={submitting}
              >
                🔗 {linkButtonText}
              </button>

              {file ? (
                <button
                  type="button"
                  onClick={() => onSelectFile(null)}
                  style={buttonStyle("danger")}
                  disabled={submitting}
                >
                  🗑 הסר קובץ
                </button>
              ) : null}

              <button
                type="button"
                onClick={submit}
                style={buttonStyle("primary")}
                disabled={submitting}
              >
                {submitting ? "שולח…" : "שליחה"}
              </button>

              {/* inputs מוסתרים */}
              <input
                ref={pickFileRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
              />
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
              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.85, marginBottom: 8, fontSize: 13 }}>תצוגה מקדימה:</div>
                {file?.type?.startsWith("video/") ? (
                  <video src={previewUrl} controls style={styles.media} />
                ) : (
                  <img src={previewUrl} alt="" style={styles.media} />
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>ברכות מאושרות</h2>

          {loading ? (
            <div style={{ opacity: 0.85 }}>טוען…</div>
          ) : posts.length === 0 ? (
            <div style={{ opacity: 0.85 }}>עדיין אין ברכות מאושרות.</div>
          ) : (
            <div style={styles.list}>
              {posts.map((p) => (
                <article key={p.id} style={styles.postCard}>
                  <div style={styles.postHead}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{formatDate(p.created_at)}</div>
                  </div>

                  <div style={styles.postMsg}>{p.message}</div>

                  {p.link_url ? (
                    <div style={{ marginTop: 10 }}>
                      🔗{" "}
                      <a href={p.link_url} target="_blank" rel="noreferrer" style={styles.link}>
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

function buttonStyle(kind: "primary" | "secondary" | "danger"): React.CSSProperties {
  const base: React.CSSProperties = {
    width: "100%",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
  };

  if (kind === "primary") {
    // כתום-חום כמו ה-SITE123, אבל קצת רך
    return {
      ...base,
      background: "rgba(201, 138, 74, 0.90)",
      borderColor: "rgba(201, 138, 74, 0.95)",
      color: "#111",
    };
  }

  if (kind === "danger") {
    return {
      ...base,
      background: "rgba(231, 76, 60, 0.22)",
      borderColor: "rgba(231, 76, 60, 0.45)",
    };
  }

  // secondary
  return base;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    // כהה "רך" ולא שחור קשוח, כדי להתאים יותר ל-SITE123
    background:
      "radial-gradient(900px 600px at 50% -10%, rgba(255,200,150,0.10), transparent 70%), #0E1116",
    color: "white",
    direction: "rtl",
    padding: 16,
  },
  container: {
    maxWidth: 520, // מובייל-פירסט, עדיין נראה טוב בדסקטופ
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  header: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 20,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
  },
  headerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  h1: {
    margin: 0,
    fontSize: 26,
    letterSpacing: 0.2,
  },
  badge: {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    opacity: 0.95,
  },
  sub: {
    margin: "10px 0 0 0",
    opacity: 0.85,
    lineHeight: 1.6,
  },
  card: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 20,
    padding: 16,
    background: "rgba(255,255,255,0.035)",
    backdropFilter: "blur(10px)",
  },
  h2: {
    margin: "0 0 12px 0",
    fontSize: 18,
  },
  form: {
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
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "13px 12px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "13px 12px",
    outline: "none",
    resize: "vertical",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 4,
  },
  list: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  postCard: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
    borderRadius: 18,
    padding: 14,
    overflow: "hidden",
  },
  postHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  postMsg: {
    marginTop: 10,
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    opacity: 0.95,
  },
  link: {
    color: "white",
    textDecoration: "underline",
    opacity: 0.95,
    wordBreak: "break-word",
  },
  media: {
    width: "100%",
    borderRadius: 16,
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
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    padding: "12px 14px",
    borderRadius: 14,
    textAlign: "center",
    zIndex: 50,
    backdropFilter: "blur(8px)",
  },
};

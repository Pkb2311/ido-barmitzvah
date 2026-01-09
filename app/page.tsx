"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type PostRow = {
  id: string;
  created_at: string;
  name: string;
  message: string;
  media_url: string | null;
  media_type: string | null; // "image" | "video" | null
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
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // 1) גלריה/קבצים רגיל
  const pickInputRef = useRef<HTMLInputElement | null>(null);
  // 2) מצלמה בנייד (capture)
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && message.trim().length > 0 && !submitting;
  }, [name, message, submitting]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function loadPosts() {
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/posts", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(j?.error || "שגיאה בטעינת הברכות");
      setPosts(Array.isArray(j?.data) ? j.data : []);
    } catch (e: any) {
      showToast(e?.message || "שגיאה בטעינה");
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  function onSelectFile(f: File | null) {
    if (!f) return;
    setFile(f);
    showToast(`נבחר קובץ: ${f.name}`);
  }

  async function submit() {
    if (!canSubmit) {
      showToast("חובה למלא שם וברכה");
      return;
    }

    // ולידציה עדינה ללינק
    const l = linkUrl.trim();
    if (l && !/^https?:\/\//i.test(l)) {
      showToast("הלינק חייב להתחיל ב-http/https");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("message", message.trim());
      if (l) fd.append("link_url", l);
      if (file) fd.append("media", file);

      const res = await fetch("/api/admin/posts", {
        method: "POST",
        body: fd,
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בשליחה");

      // ניקוי טופס
      setName("");
      setMessage("");
      setLinkUrl("");
      setFile(null);
      if (pickInputRef.current) pickInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";

      showToast("נשלח! ✅");
      await loadPosts();
    } catch (e: any) {
      showToast(e?.message || "שגיאה בשליחה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.h1}>🎉 בר מצווה של עידו</h1>
          <p style={styles.subtitle}>מעלים תמונה/סרטון/קישור או ברכה 💙</p>
        </header>

        {/* טופס העלאה */}
        <section style={styles.card}>
          <h2 style={styles.h2}>העלאת ברכה</h2>

          <div style={styles.field}>
            <label style={styles.label}>שם</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם"
              style={styles.input}
              autoComplete="name"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>ברכה לעידו</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="ברכה לעידו..."
              style={styles.textarea}
              rows={5}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>קישור (אופציונלי)</label>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              style={styles.input}
              inputMode="url"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>מדיה (אופציונלי)</label>

            {/* inputs נסתרים */}
            <input
              ref={pickInputRef}
              type="file"
              accept="image/*,video/*"
              name="media"
              style={{ display: "none" }}
              onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              name="media_camera"
              style={{ display: "none" }}
              onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => pickInputRef.current?.click()} style={btn("default")}>
                🖼️ העלאה מהגלריה
              </button>

              <button type="button" onClick={() => cameraInputRef.current?.click()} style={btn("primary")}>
                📷 צילום תמונה עכשיו
              </button>

              {file ? (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (pickInputRef.current) pickInputRef.current.value = "";
                    if (cameraInputRef.current) cameraInputRef.current.value = "";
                    showToast("הקובץ הוסר");
                  }}
                  style={btn("danger")}
                >
                  ✖ הסר קובץ
                </button>
              ) : null}
            </div>

            <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
              {file ? (
                <>
                  נבחר: <b>{file.name}</b> ({Math.round(file.size / 1024)}KB)
                </>
              ) : (
                <>לא נבחר קובץ</>
              )}
            </div>
          </div>

          <button type="button" onClick={submit} disabled={!canSubmit} style={btn(canSubmit ? "primary" : "disabled")}>
            {submitting ? "שולח..." : "שליחה"}
          </button>

          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
            תמונות/וידאו נשמרים לפי ההגדרות שלך ב־Supabase.
          </div>
        </section>

        {/* ברכות אחרונות */}
        <section style={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 style={styles.h2}>ברכות אחרונות</h2>
            <button type="button" onClick={loadPosts} style={btn("default")}>
              רענון
            </button>
          </div>

          {loadingPosts ? (
            <div style={{ opacity: 0.8 }}>טוען…</div>
          ) : posts.length === 0 ? (
            <div style={{ opacity: 0.8 }}>עדיין אין ברכות.</div>
          ) : (
            <div style={styles.grid}>
              {posts.map((p) => (
                <div key={p.id} style={styles.postCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(p.created_at)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{p.message}</div>

                  {p.link_url && (
                    <div style={{ marginTop: 10 }}>
                      🔗{" "}
                      <a href={p.link_url} target="_blank" rel="noreferrer">
                        {p.link_url}
                      </a>
                    </div>
                  )}

                  {p.media_url && (
                    <div style={{ marginTop: 10 }}>
                      {p.media_type === "video" ? (
                        <video src={p.media_url} controls style={styles.media} />
                      ) : (
                        <img src={p.media_url} alt="" style={styles.media} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast ? <div style={styles.toast}>{toast}</div> : null}
    </main>
  );
}

function btn(kind: "primary" | "danger" | "default" | "disabled" = "default"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
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
  return base;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 600px at 50% -10%, rgba(120,170,255,0.25), transparent 70%), #0b1020",
    color: "white",
    direction: "rtl",
    padding: 18,
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  header: {
    padding: "10px 2px",
  },
  h1: {
    margin: 0,
    fontSize: 34,
    letterSpacing: -0.3,
  },
  subtitle: {
    margin: "8px 0 0 0",
    opacity: 0.85,
  },
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 16,
  },
  section: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 18,
    padding: 16,
  },
  h2: {
    margin: 0,
    fontSize: 22,
  },
  field: {
    marginTop: 12,
    marginBottom: 12,
  },
  label: {
    display: "block",
    marginBottom: 6,
    opacity: 0.85,
    fontWeight: 700,
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
    outline: "none",
    fontSize: 15,
  },
  textarea: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
    outline: "none",
    fontSize: 15,
    resize: "vertical",
  },
  grid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  postCard: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
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

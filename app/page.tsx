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
  can_edit?: boolean; // מגיע מה-API
};

type UIButtonCfg = { show: boolean; label: string; color: "default" | "danger" | "send"; custom_color?: string | null };
type UISettings = {
  theme: {
    send_color: string; // שליחה (ירוק)
    default_color: string; // ברירת מחדל (לרוב כתום)
    danger_color: string; // מחיקה/הסר
    bg: string; // צבע רקע
    card_bg: string; // רקע כרטיס
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

const OWNER_TOKEN_KEY = "ido_owner_token_v1";

function getOrCreateOwnerToken() {
  if (typeof window === "undefined") return "";
  let t = window.localStorage.getItem(OWNER_TOKEN_KEY);
  if (!t) {
    t =
      (crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`) + "";
    window.localStorage.setItem(OWNER_TOKEN_KEY, t);
  }
  return t;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("he-IL");
  } catch {
    return iso;
  }
}

function formatTimeLeft(editable_until?: string | null) {
  if (!editable_until) return "";
  const ms = new Date(editable_until).getTime() - Date.now();
  if (ms <= 0) return "פג הזמן";
  const mins = Math.ceil(ms / 60000);
  if (mins <= 1) return "דקה";
  if (mins < 60) return `${mins} דקות`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}ש ${m}ד` : `${h}ש`;
}

function safeMergeUI(remote: any): UISettings {
  if (!remote || typeof remote !== "object") return DEFAULT_UI;

  const theme = { ...DEFAULT_UI.theme, ...(remote.theme || {}) };
  const buttons = {
    upload: { ...DEFAULT_UI.buttons.upload, ...(remote.buttons?.upload || {}) },
    camera: { ...DEFAULT_UI.buttons.camera, ...(remote.buttons?.camera || {}) },
    link: { ...DEFAULT_UI.buttons.link, ...(remote.buttons?.link || {}) },
    remove: { ...DEFAULT_UI.buttons.remove, ...(remote.buttons?.remove || {}) },
    refresh: { ...DEFAULT_UI.buttons.refresh, ...(remote.buttons?.refresh || {}) },
  };

  // validate color enums
  (Object.keys(buttons) as Array<keyof UISettings["buttons"]>).forEach((k) => {
    const c = (buttons[k] as any)?.color;
    if (c !== "default" && c !== "danger" && c !== "send") {
      (buttons[k] as any).color = DEFAULT_UI.buttons[k].color;
    }
    if (typeof (buttons[k] as any).show !== "boolean") {
      (buttons[k] as any).show = DEFAULT_UI.buttons[k].show;
    }
    if (typeof (buttons[k] as any).label !== "string") {
      (buttons[k] as any).label = DEFAULT_UI.buttons[k].label;
    }
    const cc = (buttons[k] as any)?.custom_color;
    if (cc !== undefined && cc !== null) {
      if (typeof cc !== "string" || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cc.trim())) {
        (buttons[k] as any).custom_color = null;
      } else {
        (buttons[k] as any).custom_color = cc.trim();
      }
    }
  });

  return { theme, buttons };
}

export default function HomePage() {
  const [ownerToken, setOwnerToken] = useState("");

  const [ui, setUi] = useState<UISettings>(DEFAULT_UI);
  const [uiLoaded, setUiLoaded] = useState(false);

  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroLinkUrl, setHeroLinkUrl] = useState<string | null>(null);

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

  // עריכה
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editLink, setEditLink] = useState("");

  const pickFileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  // token למכשיר
  useEffect(() => {
    setOwnerToken(getOrCreateOwnerToken());
  }, []);

  // ניקוי preview url
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

  async function apiFetch(input: RequestInfo, init?: RequestInit) {
    const headers = new Headers(init?.headers || {});
    if (ownerToken) headers.set("x-owner-token", ownerToken);
    return fetch(input, { ...init, headers });
  }

  async function loadUI() {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" as any });
      const j = await res.json().catch(() => ({}));
      const next = safeMergeUI(j?.ui);
      setUi(next);
      setHeroImageUrl(typeof j?.hero_image_url === "string" ? j.hero_image_url : null);
      setHeroLinkUrl(typeof j?.hero_link_url === "string" ? j.hero_link_url : null);
    } catch {
      // נשארים על DEFAULT_UI
    } finally {
      setUiLoaded(true);
    }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/posts", { cache: "no-store" as any });
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
    loadUI();
  }, []);

  useEffect(() => {
    if (!ownerToken) return;
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerToken]);

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

      const res = await apiFetch("/api/posts", {
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

  function startEdit(p: PostRow) {
    setEditingId(p.id);
    setEditName(p.name || "");
    setEditMessage(p.message || "");
    setEditLink(p.link_url || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditMessage("");
    setEditLink("");
  }

  async function saveEdit(id: string) {
    const nextName = editName.trim();
    const nextMsg = editMessage.trim();
    const nextL = editLink.trim();

    if (!nextName) {
      showToast("השם לא יכול להיות ריק");
      return;
    }

    if (!nextMsg) {
      showToast("הברכה לא יכולה להיות ריקה");
      return;
    }
    if (nextL && !/^https?:\/\//i.test(nextL)) {
      showToast("הלינק חייב להתחיל ב-http/https");
      return;
    }

    try {
      const res = await apiFetch("/api/posts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          name: nextName,
          message: nextMsg,
          link_url: nextL,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה בשמירה");

      showToast("עודכן ✅");
      cancelEdit();
      await loadPosts();
    } catch (e: any) {
      showToast(e?.message || "שגיאה בשמירה");
    }
  }

  async function deletePost(id: string) {
    const ok = window.confirm("למחוק את הברכה? זה בלתי הפיך.");
    if (!ok) return;

    try {
      const res = await apiFetch("/api/posts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "שגיאה במחיקה");

      showToast("נמחק ✅");
      await loadPosts();
    } catch (e: any) {
      showToast(e?.message || "שגיאה במחיקה");
    }
  }

  const count = useMemo(() => posts.length, [posts.length]);

  // ---------- צבעי כפתורים מהניהול ----------
  function resolveBtnKind(cfg: UIButtonCfg, force?: "send") {
    if (force === "send") return "send";
    if (cfg.color === "send") return "send";
    if (cfg.color === "danger") return "danger";
    return "default";
  }

  return (
    <main
      style={{
        ...styles.page,
        background:
          `radial-gradient(900px 600px at 50% -10%, rgba(120,170,255,0.25), transparent 70%), ${ui.theme.bg}`,
      }}
    >
      <div style={styles.container}>
        <header style={{ ...styles.header, background: ui.theme.card_bg }}>
          <div style={styles.headerTop}>
            {heroImageUrl ? (
              heroLinkUrl ? (
                <a
                  href={heroLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="מעבר לאתר"
                  style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
                >
                  <img
                    src={heroImageUrl}
                    alt="תמונת הילד"
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 999,
                      objectFit: "cover",
                      border: "2px solid rgba(255,255,255,0.35)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                      marginInlineEnd: 10,
                    }}
                  />
                </a>
              ) : (
                <img
                  src={heroImageUrl}
                  alt="תמונת הילד"
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 999,
                    objectFit: "cover",
                    border: "2px solid rgba(255,255,255,0.35)",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                    marginInlineEnd: 10,
                  }}
                />
              )
            ) : null}
            <h1 style={styles.h1}>🎉 בר מצווה</h1>
            <div style={styles.badge}>ברכות מאושרות: {count}</div>
          </div>
          <p style={styles.sub}>כתבו ברכה לעידו. אפשר לצרף תמונה/וידאו או להוסיף קישור. במובייל אפשר גם לצלם ישר מהדף.</p>
        </header>

        <section style={{ ...styles.card, background: ui.theme.card_bg }}>
          <h2 style={styles.h2}>אשמח לברכה מרגשת ממך</h2>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              <div style={styles.label}>שם</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: ישראל ישראלי"
                style={styles.input}
              />
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

            {showLink ? (
              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <div style={styles.label}>קישור (אופציונלי)</div>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  style={styles.input}
                />
              </label>
            ) : null}
          </div>

          {/* כפתורים - מותאם מובייל */}
          <div style={styles.actionsWrap}>
            {ui.buttons.upload.show ? (
              <button
                type="button"
                onClick={() => pickFileRef.current?.click()}
                style={btn(resolveBtnKind(ui.buttons.upload), ui, ui.buttons.upload.custom_color)}
                disabled={submitting}
              >
                {ui.buttons.upload.label}
              </button>
            ) : null}

            {ui.buttons.camera.show ? (
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                style={btn(resolveBtnKind(ui.buttons.camera), ui, ui.buttons.camera.custom_color)}
                disabled={submitting}
                title="במובייל זה יפתח את המצלמה"
              >
                {ui.buttons.camera.label}
              </button>
            ) : null}

            {ui.buttons.link.show ? (
              <button
                type="button"
                onClick={() => setShowLink((v) => !v)}
                style={btn(resolveBtnKind(ui.buttons.link), ui, ui.buttons.link.custom_color)}
                disabled={submitting}
              >
                {showLink ? "❌ הסתר קישור" : ui.buttons.link.label}
              </button>
            ) : null}

            {file && ui.buttons.remove.show ? (
              <button
                type="button"
                onClick={() => onSelectFile(null)}
                style={btn(resolveBtnKind(ui.buttons.remove), ui, ui.buttons.remove.custom_color)}
                disabled={submitting}
              >
                {ui.buttons.remove.label}
              </button>
            ) : null}

            {ui.buttons.refresh.show ? (
              <button
                type="button"
                onClick={loadPosts}
                style={btn(resolveBtnKind(ui.buttons.refresh), ui, ui.buttons.refresh.custom_color)}
                disabled={loading || submitting}
                title="טוען מחדש את רשימת הברכות מהשרת"
              >
                {ui.buttons.refresh.label}
              </button>
            ) : null}

            {/* שליחה תמיד ירוק */}
            <button
              type="button"
              onClick={submit}
              style={submitting ? btn("disabled", ui) : btn("send", ui)}
              disabled={submitting}
            >
              {submitting ? "שולח…" : "שליחה"}
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
              {file?.type?.startsWith("video/") ? (
                <video src={previewUrl} controls style={styles.media} />
              ) : (
                <img src={previewUrl} alt="" style={styles.media} />
              )}
            </div>
          ) : null}

          <div style={styles.smallNote}>
            ✨ טיפ: מי ששלח ברכה יכול לערוך/למחוק אותה למשך שעה מרגע השליחה (רק מאותו מכשיר).
          </div>

          {/* רמז קטן – אם לא הצליח לטעון settings */}
          {!uiLoaded ? <div style={{ marginTop: 10, opacity: 0.7, fontSize: 14 }}>טוען הגדרות עיצוב…</div> : null}
        </section>

        <section style={{ ...styles.card, background: ui.theme.card_bg }}>
          <h2 style={styles.h2}>ברכות מאושרות</h2>

          {loading ? (
            <div style={{ opacity: 0.8 }}>טוען…</div>
          ) : posts.length === 0 ? (
            <div style={{ opacity: 0.8 }}>עדיין אין ברכות מאושרות.</div>
          ) : (
            <div style={styles.list}>
              {posts.map((p) => {
                const isEditing = editingId === p.id;
                const canEdit = !!p.can_edit;

                return (
                  <article key={p.id} style={styles.postCard}>
                    <div style={styles.postTop}>
                      <div>
                        <div style={styles.postName}>{p.name}</div>
                        <div style={styles.postMeta}>
                          {formatDate(p.created_at)}
                          {canEdit ? (
                            <span style={styles.editBadge}>עריכה זמינה: {formatTimeLeft(p.editable_until)}</span>
                          ) : null}
                        </div>
                      </div>

                      {canEdit ? (
                        <div style={styles.postBtns}>
                          {isEditing ? (
                            <>
                              <button type="button" style={btnSmall("default", ui)} onClick={cancelEdit}>
                                ביטול
                              </button>
                              <button type="button" style={btnSmall("send", ui)} onClick={() => saveEdit(p.id)}>
                                שמירה
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" style={btnSmall("default", ui)} onClick={() => startEdit(p)}>
                                עריכה
                              </button>
                              <button type="button" style={btnSmall("danger", ui)} onClick={() => deletePost(p.id)}>
                                מחיקה
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div style={{ marginTop: 10 }}>
                        <div style={styles.label}>שם</div>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={styles.input}
                          placeholder="השם שלכם"
                        />

                        <div style={{ height: 10 }} />

                        <div style={styles.label}>עריכת ברכה</div>
                        <textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          style={styles.textarea}
                          rows={4}
                        />

                        <div style={{ height: 10 }} />

                        <div style={styles.label}>עריכת קישור (אופציונלי)</div>
                        <input
                          value={editLink}
                          onChange={(e) => setEditLink(e.target.value)}
                          placeholder="https://..."
                          style={styles.input}
                        />

                        <div style={styles.editHelp}>
                          לשינוי תמונה/וידאו: כרגע הכי פשוט למחוק את הברכה ולשלוח מחדש עם המדיה הנכונה.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={styles.postMessage}>{p.message}</div>

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

/** ---------- Buttons (theme-aware) ---------- **/

function btn(
  kind: "send" | "danger" | "default" | "disabled",
  ui: UISettings,
  overrideBg?: string | null
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    width: "100%",
  };

  if (overrideBg && kind !== "disabled") {
    return { ...base, background: overrideBg, borderColor: "rgba(255,255,255,0.25)" };
  }

  if (kind === "send") {
    return { ...base, background: ui.theme.send_color, borderColor: "rgba(255,255,255,0.25)" };
  }
  if (kind === "danger") {
    return { ...base, background: ui.theme.danger_color, borderColor: "rgba(255,255,255,0.25)" };
  }
  if (kind === "disabled") {
    return { ...base, opacity: 0.45, cursor: "not-allowed" };
  }
  return { ...base, background: ui.theme.default_color, borderColor: "rgba(255,255,255,0.25)" };
}

function btnSmall(
  kind: "send" | "danger" | "default",
  ui: UISettings
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 14,
    whiteSpace: "nowrap",
  };

  if (kind === "send") return { ...base, background: ui.theme.send_color, borderColor: "rgba(255,255,255,0.25)" };
  if (kind === "danger") return { ...base, background: ui.theme.danger_color, borderColor: "rgba(255,255,255,0.25)" };
  return { ...base, background: ui.theme.default_color, borderColor: "rgba(255,255,255,0.25)" };
}

/** ---------- Styles ---------- **/

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    color: "white",
    direction: "rtl",
    padding: 16,
  },
  container: {
    maxWidth: 720,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
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
    fontWeight: 900,
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 14,
    opacity: 0.95,
    fontWeight: 900,
  },
  sub: {
    margin: "10px 0 0 0",
    opacity: 0.9,
    lineHeight: 1.6,
  },
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    backdropFilter: "blur(10px)",
  },
  h2: {
    margin: "0 0 12px 0",
    fontSize: 18,
    fontWeight: 900,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    opacity: 0.95,
    fontSize: 14,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "12px 12px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "12px 12px",
    outline: "none",
    resize: "vertical",
  },
  actionsWrap: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  smallNote: {
    marginTop: 12,
    opacity: 0.85,
    fontSize: 14,
    lineHeight: 1.5,
  },
  list: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  postCard: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  postTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  postName: {
    fontWeight: 900,
    fontSize: 16,
  },
  postMeta: {
    opacity: 0.78,
    fontSize: 13,
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
  },
  editBadge: {
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.10)",
    fontWeight: 900,
  },
  postBtns: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  postMessage: {
    marginTop: 10,
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
  },
  editHelp: {
    marginTop: 10,
    opacity: 0.85,
    fontSize: 14,
    lineHeight: 1.5,
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
    fontWeight: 900,
  },
};
"use client";

import type React from "react";

type Props = {
  current: "posts" | "ui" | "images";
};

export function AdminNav({ current }: Props) {
  const items: Array<{ key: Props["current"]; label: string; href: string }> = [
    { key: "posts", label: "📬 ברכות", href: "/admin" },
    { key: "ui", label: "🎛️ עיצוב/כפתורים", href: "/admin/ui" },
    { key: "images", label: "🖼️ תמונות", href: "/admin/images" },
  ];

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(46,204,113,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  return (
    <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0 16px" }}>
      {items.map((it) => (
        <a key={it.key} href={it.href} style={pill(it.key === current)}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

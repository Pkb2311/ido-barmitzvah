
export const metadata = {
  title: "בר מצווה של עידו",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "Arial", margin: 0, background: "#0b1020", color: "white" }}>
        {children}
      </body>
    </html>
  );
}

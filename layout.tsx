import "./globals.css";
import { Heebo } from "next/font/google";

export const metadata = {
  title: "בר מצווה של עידו",
};

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body className="app-body">{children}</body>
    </html>
  );
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // מגן רק על /admin וכל מה שמתחתיו
  if (!req.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    // אם לא הוגדרה סיסמה ב-Vercel, לא נועלים כדי שלא "תינעל בחוץ"
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization") || "";
  const expected = "Basic " + btoa(`admin:${password}`);

  if (authHeader === expected) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin Area", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

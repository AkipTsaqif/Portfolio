import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

function detectLocale(request: NextRequest) {
  const accepted = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (accepted.split(",").some((language) => language.trim().startsWith("id")))
    return "id";
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const locale = detectLocale(request);
  return NextResponse.redirect(
    new URL(`/${locale}${pathname === "/" ? "" : pathname}`, request.url),
  );
}

export const config = {
  matcher: [
    "/((?!api|studio|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|rss.xml|pdf.worker.min.mjs).*)",
  ],
};

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
};

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

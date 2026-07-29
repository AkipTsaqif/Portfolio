"use client";

import Link from "next/link";
import { siteConfig } from "@/data/site";
import { localizedPath } from "@/i18n/config";
import { useI18n } from "@/i18n/client-context";

export function SiteFooter() {
  const { locale, dictionary } = useI18n();
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-kicker">{dictionary.footer.kicker}</p>
          <a className="footer-email" href={`mailto:${siteConfig.email}`}>
            {dictionary.footer.cta}
          </a>
        </div>
        <div className="footer-meta">
          <p>{dictionary.footer.location}</p>
          <div className="footer-links">
            {siteConfig.socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
            <Link href={localizedPath(locale, "/contact")}>
              {dictionary.common.contact}
            </Link>
          </div>
          <p>
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
        </div>
      </div>
    </footer>
  );
}

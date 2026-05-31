"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_LINKS } from "../lib/ui/appNavigationLinks.js";

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="주요 기능">
      {APP_NAV_LINKS.map((link) => (
        <Link className={pathname === link.href ? "active" : ""} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

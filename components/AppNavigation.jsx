"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "캐릭터 분석" },
  { href: "/efficiency", label: "전투력 효율 시뮬레이터" }
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="주요 기능">
      {LINKS.map((link) => (
        <Link className={pathname === link.href ? "active" : ""} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

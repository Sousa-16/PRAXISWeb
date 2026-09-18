"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActionIcon, Container, Group, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { requestStartPage } from "@/lib/sessionStore";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function TopBar({ right }: { right?: ReactNode }) {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");
  const pathname = usePathname();

  function goStart(e: React.MouseEvent<HTMLAnchorElement>) {
    requestStartPage();
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
  }

  return (
    <header className="topbar">
      <Container size="lg" py={12}>
        <Group justify="space-between" wrap="wrap">
          <Link href="/" className="brand-link" onClick={goStart} aria-label="PRAXIS Web home">
            <span className="brand-mark" aria-hidden />
            <span className="brand-word">PRAXIS Web</span>
          </Link>
          <Group gap="xs" wrap="wrap" className="topbar-actions">
            <ActionIcon
              variant="subtle"
              size="sm"
              radius="md"
              aria-label={computed === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setColorScheme(computed === "dark" ? "light" : "dark")}
            >
              {computed === "dark" ? <SunIcon /> : <MoonIcon />}
            </ActionIcon>
            {right}
          </Group>
        </Group>
      </Container>
    </header>
  );
}

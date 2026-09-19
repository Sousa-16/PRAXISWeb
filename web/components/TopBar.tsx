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

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.586 2 12.253c0 4.537 2.865 8.382 6.839 9.74.5.094.683-.222.683-.493 0-.243-.009-.888-.014-1.743-2.782.618-3.37-1.372-3.37-1.372-.455-1.183-1.11-1.498-1.11-1.498-.908-.636.069-.623.069-.623 1.004.072 1.532 1.055 1.532 1.055.892 1.566 2.341 1.114 2.91.852.091-.662.35-1.114.636-1.37-2.22-.259-4.555-1.14-4.555-5.073 0-1.121.39-2.038 1.029-2.756-.103-.26-.446-1.302.098-2.714 0 0 .84-.275 2.75 1.052A9.35 9.35 0 0 1 12 6.844c.85.004 1.705.117 2.504.344 1.909-1.327 2.747-1.052 2.747-1.052.546 1.412.203 2.454.1 2.714.64.718 1.028 1.635 1.028 2.756 0 3.944-2.34 4.81-4.566 5.064.359.317.679.943.679 1.901 0 1.371-.012 2.477-.012 2.813 0 .274.18.592.688.491C19.138 20.63 22 16.787 22 12.253 22 6.586 17.523 2 12 2z" />
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
            <ActionIcon
              component="a"
              href="https://github.com/Sousa-16/PRAXISWeb"
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              size="sm"
              radius="md"
              aria-label="View source on GitHub"
            >
              <GitHubIcon />
            </ActionIcon>
            {right}
          </Group>
        </Group>
      </Container>
    </header>
  );
}

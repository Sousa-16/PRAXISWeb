"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActionIcon,
  Anchor,
  Container,
  Group,
  Text,
  TextInput,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { praxisWeb } from "@/lib/api";
import { requestStartPage } from "@/lib/sessionStore";

type Hits = {
  policies: { id: string; job_id: string; tree_id: number; name?: string }[];
};

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
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hits | null>(null);
  const [searching, setSearching] = useState(false);
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");
  const pathname = usePathname();

  async function run() {
    if (!query.trim()) {
      setHits(null);
      return;
    }
    setSearching(true);
    try {
      setHits(await praxisWeb.search(query));
    } catch {
      setHits({ policies: [] });
    } finally {
      setSearching(false);
    }
  }

  function goStart(e: React.MouseEvent<HTMLAnchorElement>) {
    requestStartPage();
    if (pathname === "/") {
      e.preventDefault();
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
            <div className="topbar-search" style={{ position: "relative" }}>
              <TextInput
                size="xs"
                w="100%"
                radius="md"
                placeholder="Search saved rules…"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                onBlur={() => window.setTimeout(() => setHits(null), 200)}
                rightSection={
                  searching ? (
                    <Text size="xs" c="dimmed">
                      …
                    </Text>
                  ) : undefined
                }
              />
              {hits && (
                <div className="search-pop" style={{ padding: 12 }}>
                  {!hits.policies.length ? (
                    <Text size="sm" c="dimmed">
                      Nothing in your saved policies matches “{query}”.
                    </Text>
                  ) : (
                    <>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>
                        Policies
                      </Text>
                      {hits.policies.map((p) => (
                        <Anchor key={p.id} href={`/policy/${p.id}`} size="sm" display="block" mb={2} c="copper">
                          {p.name ? `${p.name} (${p.id})` : p.id}
                        </Anchor>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <ActionIcon
              variant="subtle"
              size="lg"
              radius="md"
              color="gray"
              aria-label="Toggle color scheme"
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

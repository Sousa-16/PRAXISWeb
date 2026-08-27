"use client";

import type { ReactNode } from "react";
import { Container } from "@mantine/core";
import { Atmosphere } from "@/components/Atmosphere";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TopBar } from "@/components/TopBar";

type Props = {
  children: ReactNode;
  topRight?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

/** Shared page chrome: atmosphere, sticky top bar, error boundary. */
export function AppShell({ children, topRight, size = "lg" }: Props) {
  return (
    <div className="app-shell">
      <Atmosphere />
      <TopBar right={topRight} />
      <Container size={size} pb="xl">
        <ErrorBoundary>{children}</ErrorBoundary>
      </Container>
    </div>
  );
}

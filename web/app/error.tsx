"use client";

import { Button, Container, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1} style={{ fontFamily: "var(--font-brand)" }}>
          Something broke
        </Title>
        <Text c="dimmed">{error.message || "The page failed to render."}</Text>
        <Button variant="light" onClick={reset} w="fit-content">
          Try again
        </Button>
        <Button component={Link} href="/" variant="subtle" w="fit-content">
          Back to PRAXIS Web
        </Button>
      </Stack>
    </Container>
  );
}

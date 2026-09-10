"use client";

import { Button, Container, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

export default function NotFound() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1} style={{ fontFamily: "var(--font-brand)" }}>
          Page not found
        </Title>
        <Text c="dimmed">That URL is not part of the workshop.</Text>
        <Button component={Link} href="/" variant="light" w="fit-content">
          Back to PRAXIS Web
        </Button>
      </Stack>
    </Container>
  );
}

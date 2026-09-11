"use client";

import { Button, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function PrivacyPage() {
  return (
    <AppShell size="md">
      <Stack gap="md" maw={640} py="lg">
        <p className="section-label">Privacy</p>
        <Title order={1} className="panel-head" style={{ margin: 0 }}>
          What this demo stores
        </Title>
        <Text size="sm">
          PRAXIS Web is a guest workshop. A cookie identifies this browser. Uploads, search runs, and
          cache files live on the API host until you click Delete my data or the guest window expires
          (default 24 hours). Other visitors cannot open your files. The server operator can.
        </Text>
        <Text size="sm">
          Do not upload secrets, personal data you are not allowed to process, or anything you would
          not put on a shared demo machine. For private work, run the API locally. The demo limits
          upload size, search cost, and how many compilations can run at once so one visitor cannot
          easily crash the shared VM.
        </Text>
        <Text size="sm" c="dimmed">
          There are no accounts, no analytics pixels, and no third-party auth. Fonts are bundled with
          the site at build time.
        </Text>
        <Button component={Link} href="/" variant="light" w="fit-content">
          Back to the workshop
        </Button>
      </Stack>
    </AppShell>
  );
}

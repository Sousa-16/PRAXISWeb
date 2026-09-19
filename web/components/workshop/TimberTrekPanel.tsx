"use client";

import { Button, Text } from "@mantine/core";
import type { JobResult } from "@/lib/types";

type Props = {
  result: JobResult;
  leftoverCount: number;
  banned: string[];
  keep: string[];
  busy: boolean;
  onTimbertrek: () => void;
};

export function TimberTrekPanel({
  result,
  leftoverCount,
  banned,
  keep,
  busy,
  onTimbertrek,
}: Props) {
  const constrained = banned.length > 0 || keep.length > 0;
  const constraintNote = constrained
    ? ` (${banned.length} won’t-have, ${keep.length} must-use)`
    : " (no columns restricted)";

  return (
    <div className="panel">
      <p className="section-label">Explore</p>
      <h2 className="panel-head">Open in TimberTrek</h2>
      <Text size="sm" c="dimmed" mb="sm">
        For an alternative data visualization experience to view your up to 2,000 best-filtered trees in the Rashomon set, researchers at Georgia Tech, Duke, Fujitsu, and UBC have developed an interactive tool that summarizes the entire Rashomon set of sparse decision trees and empowers users to curate trees that meet their needs. To export your trees, download the JSON below and upload it to their{" "}
        <Text
          span
          component="a"
          href="https://poloclub.github.io/timbertrek/"
          target="_blank"
          rel="noreferrer"
          c="copper"
          fw={600}
        >
          “my own set”
        </Text>{" "}
        tab (use the file picker).
      </Text>
      <Button variant="light" loading={busy} disabled={!leftoverCount} onClick={onTimbertrek}>
        Download matching trees
      </Button>
    </div>
  );
}

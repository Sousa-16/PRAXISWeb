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
        Download up to{" "}
        <Text span fw={600}>
          2,000
        </Text>{" "}
        trees that still fit your Set Tree Rules choices
        {constraintNote}. You currently have {leftoverCount.toLocaleString()} profiled survivors;
        PRAXIS found {result.n_trees.toLocaleString()} near-optimal trees in total. When row
        counts are missing (for example after a cold restart without a reloaded fit), the JSON may
        use approximate leaf sizes so TimberTrek still bins — re-run Find good rules for exact
        counts. Upload the JSON on their{" "}
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

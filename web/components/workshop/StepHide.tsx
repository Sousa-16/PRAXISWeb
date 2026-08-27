"use client";

import { Alert, Button, Group, Progress, SegmentedControl, SimpleGrid, Stack, Text } from "@mantine/core";
import type { ConstraintMode, JobResult } from "@/lib/types";

type Props = {
  result: JobResult;
  leftoverCount: number;
  matchCount: number | null;
  matchCounting: boolean;
  matchCountStale?: boolean;
  columns: string[];
  constrained: boolean;
  bestAll: number | null;
  bestLeft: number | null;
  profiled: boolean;
  profiling: boolean;
  modeOf: (col: string) => ConstraintMode;
  setMode: (col: string, mode: ConstraintMode) => void;
  onReset: () => void;
  onHideAll: () => void;
  onContinue: () => void;
};

export function StepHide({
  result,
  leftoverCount,
  matchCount,
  matchCounting,
  matchCountStale = false,
  columns,
  constrained,
  bestAll,
  bestLeft,
  profiled,
  profiling,
  modeOf,
  setMode,
  onReset,
  onHideAll,
  onContinue,
}: Props) {
  const total = result.n_trees;
  const surviving = matchCount ?? (constrained ? null : total);
  const ratio =
    surviving != null && total > 0 ? Math.min(100, (surviving / total) * 100) : profiled && result.n_profiled
      ? (leftoverCount / result.n_profiled) * 100
      : 0;

  return (
    <Stack gap="md" className="step-flow">
      <div className="panel">
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <p className="section-label">{constrained ? "Still allowed" : "PRAXIS found"}</p>
            <h2 className="panel-head">
              {surviving == null && matchCounting ? "…" : (surviving ?? "-").toLocaleString()}
              <Text span c="dimmed" fz="md" fw={400}>
                {" "}
                / {total.toLocaleString()}
              </Text>{" "}
              <Text span c="dimmed" fz="md" fw={400}>
                near-optimal trees
              </Text>
            </h2>
            <Text size="sm" c="dimmed" maw={520}>
              The left number is how many of all {total.toLocaleString()} PRAXIS trees still fit your
              choices (won’t-have and must-use for one column are complements: they add up to the
              total). Profiling only unpacks up to 2,000 of those matches for the next steps; that
              unpack cap is not the match count.
              {matchCountStale
                ? " Live counts are unavailable until you run Find good rules again (the fitted job left memory)."
                : surviving == null && constrained
                  ? " Waiting for live counts…"
                  : ""}
              {profiled
                ? ` ${leftoverCount.toLocaleString()} of ${result.n_profiled.toLocaleString()} already-profiled trees match the current choices.`
                : ""}
            </Text>
          </div>
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={onReset}>
              Reset
            </Button>
            <Button size="xs" variant="default" onClick={onHideAll}>
              Ban all
            </Button>
          </Group>
        </Group>
        <Progress
          mt="sm"
          value={ratio}
          color={surviving === 0 ? "red" : "copper"}
          size="md"
          radius="sm"
          animated={matchCounting}
        />
      </div>
      {profiled && constrained && bestAll != null && bestLeft != null && (
        <Alert
          variant="light"
          color={bestAll - bestLeft > 0.02 ? "yellow" : "sea"}
          title="Accuracy trade-off"
        >
          Best surviving rule: {(bestLeft * 100).toFixed(1)}% on unseen rows. Best among profiled:{" "}
          {(bestAll * 100).toFixed(1)}%.{" "}
          {bestAll - bestLeft <= 0.001
            ? "These choices cost nothing."
            : `Cost: ${((bestAll - bestLeft) * 100).toFixed(1)} points of accuracy.`}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {columns.map((col) => (
          <div key={col} className="col-chip">
            <div className="col-chip-row">
              <div>
                <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                  {col}
                </Text>
                <Text size="xs" c="dimmed">
                  {result.column_kinds[col] || "column"}
                  {result.column_use && col in result.column_use
                    ? ` · in ${result.column_use[col].toLocaleString()} / ${total.toLocaleString()} trees`
                    : ""}
                </Text>
                {result.column_use && result.column_use[col] === 0 ? (
                  <Text size="xs" c="orange.7">
                    Unused in this set: Must use → 0, Won’t have → all trees
                  </Text>
                ) : null}
              </div>
              <SegmentedControl
                size="xs"
                radius="sm"
                value={modeOf(col)}
                onChange={(v) => setMode(col, v as ConstraintMode)}
                data={[
                  { label: "Either", value: "off" },
                  { label: "Won’t have", value: "banned" },
                  { label: "Must use", value: "keep" },
                ]}
              />
            </div>
          </div>
        ))}
      </SimpleGrid>
      {surviving === 0 ? (
        <Alert color="red">No tree fits these choices. Reset or loosen them before profiling.</Alert>
      ) : (
        <Button
          size="md"
          onClick={onContinue}
          loading={profiling}
          style={{ alignSelf: "stretch" }}
          maw={{ base: "100%", sm: 420 }}
        >
          {profiling
            ? "Profiling matching trees…"
            : profiled
              ? "Re-profile with these columns"
              : "Profile matching trees (up to 2,000)"}
        </Button>
      )}
      {result.matching_note && (
        <Text size="xs" c="dimmed">
          {result.matching_note}
        </Text>
      )}
    </Stack>
  );
}

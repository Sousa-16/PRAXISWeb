"use client";

import {
  Alert,
  Button,
  FileButton,
  Group,
  Progress,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { COMPILE_MSGS } from "@/lib/constants";
import type { DatasetPreview, Job, JobResult } from "@/lib/types";

type Props = {
  dataset: DatasetPreview;
  label: string;
  setLabel: (v: string) => void;
  warnOwn: boolean;
  busy: boolean;
  compiling: boolean;
  msgIdx: number;
  job: Job | null;
  result: JobResult | null;
  onSearch: () => void;
  onUpload: (file: File | null) => void;
  onContinue: () => void;
};

export function StepLoad({
  dataset,
  label,
  setLabel,
  warnOwn,
  busy,
  compiling,
  msgIdx,
  job,
  result,
  onSearch,
  onUpload,
  onContinue,
}: Props) {
  return (
    <Stack gap="md" className="step-flow">
      {warnOwn && (
        <Alert color="yellow" variant="light" title="Your own file">
          Other visitors cannot open this upload. Do not upload secrets. Max 20 MB and 5,000 rows.
        </Alert>
      )}
      <div className="panel">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <div>
            <p className="section-label">Your table</p>
            <h2 className="panel-head" style={{ margin: 0 }}>
              {dataset.filename}
            </h2>
            <Text size="sm" c="dimmed">
              {dataset.n_rows.toLocaleString()} rows · {dataset.n_cols} columns
            </Text>
          </div>
          <Select
            label="Label column (what to predict)"
            data={dataset.columns}
            value={label}
            onChange={(v) => v && setLabel(v)}
            w={{ base: "100%", sm: 230 }}
            maw={360}
          />
        </Group>
        <Text size="sm" c="dimmed" mt="sm" maw={560}>
          Pick the column that holds the answer. Then search for short if-then rules that predict it well.
        </Text>
        <Table.ScrollContainer minWidth={Math.max(640, dataset.columns.length * 112)} mt="md">
          <Table striped highlightOnHover withTableBorder className="data-table">
            <Table.Thead>
              <Table.Tr>
                {dataset.columns.map((c) => (
                  <Table.Th key={c} c={c === label ? "copper" : undefined} title={c}>
                    {c}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {dataset.head.map((r, i) => (
                <Table.Tr key={i}>
                  {dataset.columns.map((c) => (
                    <Table.Td key={c} className="mono" fz="xs" title={String(r[c] ?? "")}>
                      {r[c]}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="xs" c="dimmed" mt={6}>
          Scroll sideways to see every column. Preview shows the first rows only.
        </Text>
        <Group mt="lg" wrap="wrap" className="cta-stack">
          <Button onClick={onSearch} loading={busy || compiling} disabled={!label}>
            {compiling ? "Searching…" : "Find good rules"}
          </Button>
          <FileButton onChange={onUpload} accept=".csv,text/csv">
            {(props) => (
              <Button {...props} variant="subtle" size="sm">
                Change file
              </Button>
            )}
          </FileButton>
          {job?.status === "failed" && (
            <Text c="red" size="sm">
              {job.error}
            </Text>
          )}
          {result && (
            <Button variant="light" onClick={onContinue}>
              Continue: {result.n_trees.toLocaleString()} trees found
            </Button>
          )}
        </Group>
        {compiling && (
          <Stack gap={6} mt="md">
            <Progress value={100} striped animated color="copper" size="sm" radius="sm" />
            <Text size="sm" c="dimmed" className="mono">
              {COMPILE_MSGS[msgIdx]}
            </Text>
          </Stack>
        )}
      </div>
    </Stack>
  );
}

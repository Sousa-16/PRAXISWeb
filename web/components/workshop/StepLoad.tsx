"use client";

import {
  Alert,
  Button,
  Collapse,
  FileButton,
  Group,
  NumberInput,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useState } from "react";
import { COMPILE_MSGS } from "@/lib/constants";
import {
  DEFAULT_FIT_PARAMS,
  FIT_PARAM_BOUNDS,
  FIT_PARAM_FIELDS,
  clampFitParams,
  type FitParams,
} from "@/lib/fitParams";
import type { DatasetPreview, Job, JobResult } from "@/lib/types";

type Props = {
  dataset: DatasetPreview;
  label: string;
  setLabel: (v: string) => void;
  fitParams: FitParams;
  setFitParams: (next: FitParams) => void;
  warnOwn: boolean;
  busy: boolean;
  compiling: boolean;
  msgIdx: number;
  job: Job | null;
  result: JobResult | null;
  maxRows?: number;
  maxUploadBytes?: number;
  onSearch: () => void;
  onUpload: (file: File | null) => void;
  onContinue: () => void;
};

export function StepLoad({
  dataset,
  label,
  setLabel,
  fitParams,
  setFitParams,
  warnOwn,
  busy,
  compiling,
  msgIdx,
  job,
  result,
  maxRows = 100000,
  maxUploadBytes = 20 * 1024 * 1024,
  onSearch,
  onUpload,
  onContinue,
}: Props) {
  const maxMb = Math.round(maxUploadBytes / (1024 * 1024));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const maxLookahead = Math.max(0, fitParams.depth_budget - 1);

  function updateParam<K extends keyof FitParams>(key: K, value: number | string) {
    const n = typeof value === "number" ? value : Number(value);
    setFitParams(clampFitParams({ ...fitParams, [key]: n }));
  }

  return (
    <Stack gap="md" className="step-flow">
      {warnOwn && (
        <Alert color="yellow" variant="light" title="Your own file">
          Other visitors cannot open this upload. Do not upload secrets. Max {maxMb} MB and{" "}
          {maxRows.toLocaleString()} rows.
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

        <div className="panel" style={{ marginTop: "1.25rem", padding: "12px 14px" }}>
          <Group justify="space-between" align="center" wrap="wrap">
            <UnstyledButton onClick={() => setSettingsOpen((o) => !o)} style={{ textAlign: "left" }}>
              <Text fw={600} size="sm">
                Search settings {settingsOpen ? "▾" : "▸"}
              </Text>
              <Text size="xs" c="dimmed">
                Optional. Defaults match a typical workshop run.
              </Text>
            </UnstyledButton>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setFitParams({ ...DEFAULT_FIT_PARAMS })}
              disabled={busy || compiling}
            >
              Reset to defaults
            </Button>
          </Group>
          <Collapse in={settingsOpen}>
            <Stack gap="md" mt="md">
              {FIT_PARAM_FIELDS.map((field) => {
                const bounds = FIT_PARAM_BOUNDS[field.key];
                const max =
                  field.key === "lookahead_k" ? Math.min(bounds.max, maxLookahead) : bounds.max;
                const isPct = field.key === "rashomon_mult";
                return (
                  <NumberInput
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={
                      isPct
                        ? Math.round(fitParams.rashomon_mult * 1000) / 10
                        : fitParams[field.key]
                    }
                    onChange={(v) => {
                      if (v === "" || v === undefined || v === null) return;
                      if (isPct) updateParam("rashomon_mult", Number(v) / 100);
                      else updateParam(field.key, Number(v));
                    }}
                    min={isPct ? bounds.min * 100 : bounds.min}
                    max={isPct ? bounds.max * 100 : max}
                    step={isPct ? 1 : bounds.step}
                    decimalScale={field.key === "lambda_reg" ? 3 : isPct ? 1 : 0}
                    suffix={isPct ? "%" : undefined}
                    w="100%"
                    maw={420}
                    disabled={busy || compiling}
                  />
                );
              })}
            </Stack>
          </Collapse>
        </div>

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

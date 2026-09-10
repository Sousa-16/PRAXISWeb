"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  FileButton,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { PredictionBoard } from "@/components/PredictionBoard";
import { TreeFlow } from "@/components/TreeFlow";
import { praxisWeb } from "@/lib/api";
import { downloadText } from "@/lib/download";
import { pythonScorer } from "@/lib/policyExport";
import { downloadRashomonTrie, rashomonTrieText } from "@/lib/rashomonExport";
import type { ImpactOut, JobResult, ScoreOut, TreeProfile } from "@/lib/types";

type Props = {
  selected: TreeProfile;
  score: ScoreOut | null;
  result: JobResult | null;
  leftover: TreeProfile[];
  banned: string[];
  keep: string[];
  jobId?: string;
  columns: string[];
  row: Record<string, string>;
  setRow: (fn: (r: Record<string, string>) => Record<string, string>) => void;
  scoreCols: string[];
  maxRows?: number;
  impact: ImpactOut | null;
  impactCol: string | null;
  setImpactCol: (v: string | null) => void;
  impactClasses: string[];
  busy: boolean;
  onScore: () => void;
  onImpact: () => void;
  onResetImpact: () => void;
};

export function StepScore({
  selected,
  score,
  result,
  leftover,
  banned,
  keep,
  jobId,
  columns,
  row,
  setRow,
  scoreCols,
  maxRows = 100000,
  impact,
  impactCol,
  setImpactCol,
  impactClasses,
  busy,
  onScore,
  onImpact,
  onResetImpact,
}: Props) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleView, setRuleView] = useState<"diagram" | "text">("diagram");
  const [batchBusy, setBatchBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const exportFilename = `surviving_rules${jobId ? `_${jobId}` : ""}.json`;
  const exportJson = useMemo(() => {
    if (!result) return "";
    return rashomonTrieText(result, leftover, banned, keep);
  }, [result, leftover, banned, keep]);

  const breakdownColumns = useMemo(() => {
    if (!result) return [];
    return columns.filter((c) => c !== result.label);
  }, [columns, result]);

  const breakdownOptions = useMemo(
    () =>
      breakdownColumns.map((c) => {
        const kind = result?.column_kinds[c] || "column";
        return { value: c, label: `${c} (${kind})` };
      }),
    [breakdownColumns, result],
  );

  const breakdownHint =
    breakdownOptions.length === 0
      ? "No other columns to group by; you’ll get one overall summary."
      : breakdownOptions.every((o) => o.label.includes("(numeric)"))
        ? "Your file has mostly numeric columns (typical for spambase-style data). Each distinct value becomes a group; pick a column with few values, or leave this empty for overall only."
        : "Leave empty for one overall summary, or pick a column to compare prediction rates across groups (works best for categorical and binary columns).";

  async function scoreBatch(file: File | null) {
    if (!file || !jobId) return;
    setBatchBusy(true);
    try {
      const csv = await praxisWeb.scoreJobBatch(jobId, file, {
        tree_id: selected.id,
        banned,
        keep,
      });
      downloadText(`scored_${jobId}.csv`, csv, "text/csv");
      notifications.show({
        title: "Batch scored",
        message: "Your file is downloading with prediction, rules_agree, and reason columns added.",
        color: "copper",
      });
    } catch (err) {
      notifications.show({ title: "Batch scoring failed", message: String(err), color: "red" });
    } finally {
      setBatchBusy(false);
    }
  }

  async function downloadFrozen(kind: "json" | "python") {
    if (!jobId) return;
    setExportBusy(true);
    try {
      const frozen = await praxisWeb.freezeJob(jobId, {
        tree_id: selected.id,
        banned,
        keep,
      });
      if (kind === "json") {
        downloadText(`rule_${jobId}_${selected.id}.json`, JSON.stringify(frozen, null, 2), "application/json");
      } else {
        downloadText(`score_rule_${jobId}_${selected.id}.py`, pythonScorer(frozen), "text/x-python");
      }
    } catch (err) {
      notifications.show({ title: "Could not export rule", message: String(err), color: "red" });
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <Stack gap="md" className="step-flow">
      {score && (
        <PredictionBoard
          score={score}
          caption={`${score.agree} of ${score.n} other surviving rules agree.`}
        />
      )}

      <div className="panel">
        <Group justify="space-between" mb="sm" wrap="wrap">
          <h2 className="panel-head" style={{ margin: 0 }}>
            Rule {selected.id}
          </h2>
          <Group gap="xs">
            {selected.acc != null && (
              <Badge variant="light" color="sea">
                {(selected.acc * 100).toFixed(1)}% accuracy
              </Badge>
            )}
            <Button
              size="compact-xs"
              variant={ruleView === "diagram" ? "filled" : "default"}
              onClick={() => setRuleView("diagram")}
              disabled={!selected.diagram?.nodes?.length}
            >
              Illustration
            </Button>
            <Button
              size="compact-xs"
              variant={ruleView === "text" ? "filled" : "default"}
              onClick={() => setRuleView("text")}
            >
              Text
            </Button>
          </Group>
        </Group>
        {ruleView === "diagram" && selected.diagram?.nodes ? (
          <div className="tree-scroll compare-tree-diagram">
            <TreeFlow nodes={selected.diagram.nodes} highlight={score?.prediction} />
          </div>
        ) : (
          <Stack gap={4}>
            {(score?.rules?.length ? score.rules : selected.rules).map((rule) => (
              <Text key={rule} size="sm" className="mono">
                {rule}
              </Text>
            ))}
          </Stack>
        )}
      </div>

      {result && (
        <div className="panel">
          <p className="section-label">One case</p>
          <h2 className="panel-head">Score a row</h2>
          <Text size="sm" c="dimmed" mb="sm">
            Fill in the columns this rule uses, then score. Same encodings as the search—no new fit.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
            {scoreCols.map((col) => {
              const codes = result.column_codes?.[col];
              if (codes && Object.keys(codes).length) {
                return (
                  <Select
                    key={col}
                    label={col}
                    data={Object.keys(codes)}
                    value={row[col] || null}
                    onChange={(v) => setRow((r) => ({ ...r, [col]: v || "" }))}
                  />
                );
              }
              return (
                <TextInput
                  key={col}
                  label={col}
                  value={row[col] || ""}
                  onChange={(e) => setRow((r) => ({ ...r, [col]: e.currentTarget.value }))}
                />
              );
            })}
          </SimpleGrid>
          <Button
            mt="md"
            onClick={onScore}
            loading={busy}
            disabled={!jobId || scoreCols.some((c) => !row[c])}
          >
            Score
          </Button>
        </div>
      )}

      {result && jobId && (
        <div className="panel">
          <p className="section-label">Batch</p>
          <h2 className="panel-head">Score a whole file</h2>
          <Text size="sm" c="dimmed" mb="sm">
            Upload a CSV with the same columns. You get prediction, rules_agree, and reason columns
            added. Max {maxRows.toLocaleString()} rows.
          </Text>
          <FileButton onChange={scoreBatch} accept=".csv,text/csv">
            {(props) => (
              <Button {...props} variant="light" loading={batchBusy}>
                Upload CSV to score
              </Button>
            )}
          </FileButton>
        </div>
      )}

      {result && (
        <div className="panel">
          <p className="section-label">Export</p>
          <h2 className="panel-head">Take this rule with you</h2>
          <Text size="sm" c="dimmed" mb="sm">
            Download the frozen rule as JSON, or a small Python script that scores CSVs with no
            dependencies—it keeps working even if this server goes away. You can also archive every
            surviving rule under your column choices.
          </Text>
          <Group wrap="wrap" className="cta-stack">
            <Button variant="default" loading={exportBusy} disabled={!jobId} onClick={() => downloadFrozen("json")}>
              Download rule JSON
            </Button>
            <Button
              variant="default"
              loading={exportBusy}
              disabled={!jobId}
              onClick={() => downloadFrozen("python")}
            >
              Download Python scorer
            </Button>
            <Button variant="light" onClick={() => setRulesOpen(true)} disabled={!leftover.length}>
              View surviving rules JSON
            </Button>
            <Button
              variant="default"
              disabled={!leftover.length}
              onClick={() => downloadRashomonTrie(exportFilename, result, leftover, banned, keep)}
            >
              Download surviving rules
            </Button>
          </Group>
          <Modal
            opened={rulesOpen}
            onClose={() => setRulesOpen(false)}
            title={`Surviving rules · ${leftover.length}`}
            size="xl"
            centered
          >
            <Text size="sm" c="dimmed" mb="sm">
              Every rule that still passes your won’t-have / must-use choices, plus those choices
              themselves.
            </Text>
            <pre
              className="mono"
              style={{
                maxHeight: "min(60vh, 520px)",
                overflow: "auto",
                margin: 0,
                padding: "12px 14px",
                borderRadius: 8,
                background: "rgba(15, 23, 42, 0.06)",
                fontSize: 12,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {exportJson}
            </pre>
            <Group mt="md" justify="flex-end">
              <Button
                onClick={() => downloadRashomonTrie(exportFilename, result, leftover, banned, keep)}
              >
                Download .json
              </Button>
            </Group>
          </Modal>
        </div>
      )}

      {result && (
        <div className="panel">
          <p className="section-label">Impact preview</p>
          <h2 className="panel-head">How this tree decides on your whole file</h2>
          <Text size="sm" c="dimmed" mb="sm">
            Runs the selected tree on every row you uploaded and counts how often it predicts each
            class. This is not a fairness audit by itself; it helps you spot skew before you export.
          </Text>
          <Text size="sm" c="dimmed" mb="sm">
            {breakdownHint}
          </Text>
          <Group align="flex-end" wrap="wrap">
            <Select
              label="Break down by (optional)"
              placeholder="Overall only, no grouping"
              clearable
              searchable
              nothingFoundMessage="No columns"
              data={breakdownOptions}
              value={impactCol}
              onChange={setImpactCol}
              w={{ base: "100%", sm: 280 }}
              maw={360}
              disabled={!breakdownOptions.length}
            />
            <Button variant="light" onClick={onImpact} loading={busy}>
              Run on full file
            </Button>
            <Button variant="default" onClick={onResetImpact} disabled={!impact && !impactCol}>
              Reset preview
            </Button>
          </Group>
          {impact && (
            <>
              {impact.groups.length > 40 && (
                <Text size="xs" c="dimmed" mt="sm">
                  Showing the 40 largest groups of {impact.groups.length.toLocaleString()}. Prefer a
                  column with fewer distinct values for a clearer breakdown.
                </Text>
              )}
              <Table.ScrollContainer
                minWidth={Math.max(420, 160 + 88 + impactClasses.length * 88)}
                mt="md"
              >
                <Table striped highlightOnHover withTableBorder className="data-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th className="data-table-stub" title={impact.group_by || "All rows"}>
                        {impact.group_by ? impact.group_by : "All rows"}
                      </Table.Th>
                      <Table.Th>Rows</Table.Th>
                      {impactClasses.map((c) => (
                        <Table.Th key={c} title={`% ${c}`}>
                          % {c}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {[
                      { value: "All rows", n: impact.n, counts: impact.overall },
                      ...[...impact.groups].sort((a, b) => b.n - a.n).slice(0, 40),
                    ].map((g) => (
                      <Table.Tr key={g.value}>
                        <Table.Td
                          className="data-table-stub"
                          fw={g.value === "All rows" ? 700 : undefined}
                          title={g.value}
                        >
                          {g.value}
                        </Table.Td>
                        <Table.Td className="mono">{g.n}</Table.Td>
                        {impactClasses.map((c) => (
                          <Table.Td key={c} className="mono">
                            {g.n ? `${(((g.counts[c] || 0) / g.n) * 100).toFixed(1)}%` : "-"}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </>
          )}
        </div>
      )}
    </Stack>
  );
}

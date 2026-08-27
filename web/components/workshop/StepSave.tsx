"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { PredictionBoard } from "@/components/PredictionBoard";
import { TreeSvg } from "@/components/TreeSvg";
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
  impact: ImpactOut | null;
  impactCol: string | null;
  setImpactCol: (v: string | null) => void;
  impactClasses: string[];
  busy: boolean;
  onImpact: () => void;
  onResetImpact: () => void;
  polName: string;
  setPolName: (v: string) => void;
  polNotes: string;
  setPolNotes: (v: string) => void;
  onSave: () => void;
  policyId: string | null;
};

export function StepSave({
  selected,
  score,
  result,
  leftover,
  banned,
  keep,
  jobId,
  columns,
  impact,
  impactCol,
  setImpactCol,
  impactClasses,
  busy,
  onImpact,
  onResetImpact,
  polName,
  setPolName,
  polNotes,
  setPolNotes,
  onSave,
  policyId,
}: Props) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleView, setRuleView] = useState<"diagram" | "text">("diagram");
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

  return (
    <Stack gap="md" className="step-flow">
      {score && <PredictionBoard score={score} />}

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
            <TreeSvg nodes={selected.diagram.nodes} highlight={score?.prediction} />
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
          <p className="section-label">Export</p>
          <h2 className="panel-head">Download every surviving rule</h2>
          <Text size="sm" c="dimmed" mb="sm">
            {leftover.length} rule{leftover.length === 1 ? "" : "s"} still fit your column choices
            {banned.length || keep.length
              ? ` (${banned.length} won’t-have, ${keep.length} must-use)`
              : " (no columns restricted)"}. View or download them as a{" "}
            <span className="mono">.json</span> file you can archive or share.
          </Text>
          <Group wrap="wrap" className="cta-stack">
            <Button variant="light" onClick={() => setRulesOpen(true)} disabled={!leftover.length}>
              View JSON
            </Button>
            <Button
              variant="default"
              disabled={!leftover.length}
              onClick={() => downloadRashomonTrie(exportFilename, result, leftover, banned, keep)}
            >
              Download .json
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
            Runs the selected tree on every row you uploaded and counts how often it predicts each class.
            This is not a fairness audit by itself; it helps you spot skew before you save a policy.
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
            <Button
              variant="default"
              onClick={onResetImpact}
              disabled={!impact && !impactCol}
            >
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

      <div className="panel">
        <p className="section-label">Keep it</p>
        <h2 className="panel-head">Save as policy</h2>
        <Text size="sm" c="dimmed" mb="sm">
          Locks this exact rule so you can score new rows later from a permanent page: same thresholds,
          same encodings, no new search.
        </Text>
        <TextInput
          label="Policy name (optional)"
          placeholder="e.g. 2026 Q3 small-loan rule"
          value={polName}
          onChange={(e) => setPolName(e.currentTarget.value)}
          w="100%"
          maw={420}
        />
        <Textarea
          label="Notes (optional)"
          placeholder="Why these columns were hidden, who approved this, etc."
          value={polNotes}
          onChange={(e) => setPolNotes(e.currentTarget.value)}
          mt="xs"
          w="100%"
          maw={640}
          autosize
          minRows={2}
        />
        <Group mt="md" wrap="wrap" className="cta-stack">
          <Button onClick={onSave} loading={busy}>
            Save as policy
          </Button>
          {policyId && (
            <Text size="sm" component="a" href={`/policy/${policyId}`} c="copper" fw={600} style={{ overflowWrap: "anywhere" }}>
              {`Saved as ${policyId} → open its page`}
            </Text>
          )}
        </Group>
      </div>
    </Stack>
  );
}

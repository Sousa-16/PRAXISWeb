"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AppShell } from "@/components/AppShell";
import { PredictionBoard } from "@/components/PredictionBoard";
import { TreeSvg } from "@/components/TreeSvg";
import { praxisWeb } from "@/lib/api";
import { downloadText } from "@/lib/download";
import { pythonScorer } from "@/lib/policyExport";
import type { Policy, ScoreOut } from "@/lib/types";

export default function PolicyPage() {
  const params = useParams<{ id: string }>();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Record<string, string>>({});
  const [score, setScore] = useState<ScoreOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  useEffect(() => {
    praxisWeb
      .getPolicy(params.id)
      .then(setPolicy)
      .catch((err) => setError(String(err)));
  }, [params.id]);

  async function scoreRow() {
    setBusy(true);
    try {
      setScore(await praxisWeb.scorePolicy(params.id, row));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function scoreBatch(file: File | null) {
    if (!file) return;
    setBatchBusy(true);
    try {
      const csv = await praxisWeb.scorePolicyBatch(params.id, file);
      downloadText(`scored_${params.id}.csv`, csv, "text/csv");
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

  const cols = policy?.tree.bases || policy?.maps?.columns || [];

  return (
    <AppShell size="md">
      <div className="rise">
        <p className="section-label">Saved policy</p>
        <h1
          style={{
            fontFamily: "var(--font-brand)",
            fontWeight: 800,
            fontSize: "clamp(2rem, 5vw, 3.2rem)",
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          {policy?.name || `Policy ${params.id}`}
        </h1>
        <Group gap="xs" mt="sm">
          <Badge variant="light" color="sea" className="mono" tt="none">
            id {params.id}
          </Badge>
          {policy?.label && (
            <Badge variant="light" color="sea" tt="none">
              predicts {policy.label}
            </Badge>
          )}
          {policy?.tree?.acc != null && (
            <Badge variant="light" color="sea" tt="none">
              {(policy.tree.acc * 100).toFixed(1)}% accuracy
            </Badge>
          )}
        </Group>
        {policy?.notes && (
          <Text size="sm" mt="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }} maw={640}>
            {policy.notes}
          </Text>
        )}
      </div>

      {error && (
        <Alert color="red" mt="md">
          {error}
        </Alert>
      )}

      {policy && (
        <Stack mt="lg" gap="md">
          <div className="panel rise rise-1">
            <Text size="sm" c="dimmed" mb="sm">
              This page uses the saved rule as-is. It does not search for new ones.
            </Text>
            {policy.tree.diagram?.nodes && (
              <div className="tree-scroll compare-tree-diagram">
                <TreeSvg nodes={policy.tree.diagram.nodes} highlight={score?.prediction} />
              </div>
            )}
            <Stack gap={4} mt="sm">
              {(policy.tree.rules || []).map((rule) => (
                <Text key={rule} size="sm" className="mono">
                  {rule}
                </Text>
              ))}
            </Stack>
          </div>

          <div className="panel rise rise-2">
            <p className="section-label">One case</p>
            <h2 className="panel-head">Score a row</h2>
            <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
              {cols.map((col) => {
                const codes = policy.maps?.codes?.[col];
                if (codes) {
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
            <Button mt="md" onClick={scoreRow} loading={busy}>
              Score
            </Button>
          </div>

          {score && (
            <PredictionBoard
              score={score}
              caption={`${score.agree} of ${score.n} other saved rules agree.`}
            />
          )}

          <div className="panel">
            <p className="section-label">Batch</p>
            <h2 className="panel-head">Score a whole file</h2>
            <Text size="sm" c="dimmed" mb="sm">
              Upload a CSV with the same columns. You get prediction, rules_agree, and reason columns
              added. Max 5,000 rows.
            </Text>
            <FileButton onChange={scoreBatch} accept=".csv,text/csv">
              {(props) => (
                <Button {...props} variant="light" loading={batchBusy}>
                  Upload CSV to score
                </Button>
              )}
            </FileButton>
          </div>

          <div className="panel">
            <p className="section-label">Export</p>
            <h2 className="panel-head">Take this policy with you</h2>
            <Text size="sm" c="dimmed" mb="sm">
              Download JSON, or a small Python script that scores CSVs with no dependencies; it keeps
              working even if this server goes away.
            </Text>
            <Group wrap="wrap" className="cta-stack">
              <Button
                variant="default"
                onClick={() =>
                  downloadText(`policy_${params.id}.json`, JSON.stringify(policy, null, 2), "application/json")
                }
              >
                Download JSON
              </Button>
              <Button
                variant="default"
                onClick={() => downloadText(`score_policy_${params.id}.py`, pythonScorer(policy), "text/x-python")}
              >
                Download Python scorer
              </Button>
            </Group>
          </div>
        </Stack>
      )}
    </AppShell>
  );
}

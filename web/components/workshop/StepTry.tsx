"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { PAGE_SIZE } from "@/lib/constants";
import { TreeFlow } from "@/components/TreeFlow";
import { TimberTrekPanel } from "@/components/workshop/TimberTrekPanel";
import type { JobResult, RuleSort, TreeProfile } from "@/lib/types";

type Props = {
  result: JobResult;
  leftover: TreeProfile[];
  slice: TreeProfile[];
  selected: TreeProfile;
  page: number;
  pages: number;
  setPage: (p: number) => void;
  ruleSort: RuleSort;
  setRuleSort: (s: RuleSort) => void;
  compare: number[];
  compared: TreeProfile[];
  toggleCompare: (id: number) => void;
  setCompare: (ids: number[]) => void;
  setTreeId: (id: number) => void;
  busy: boolean;
  onContinue: () => void;
  banned: string[];
  keep: string[];
  onTimbertrekBest?: (expand?: boolean) => void;
};

export function StepTry({
  result,
  leftover,
  slice,
  selected,
  page,
  pages,
  setPage,
  ruleSort,
  setRuleSort,
  compare,
  compared,
  toggleCompare,
  setCompare,
  setTreeId,
  busy,
  onContinue,
  banned,
  keep,
  onTimbertrekBest,
}: Props) {
  const [compareView, setCompareView] = useState<"diagram" | "text">("diagram");
  const [expandedTree, setExpandedTree] = useState<TreeProfile | null>(null);

  function treeMeta(tree: TreeProfile) {
    const features = tree.bases?.length ?? 0;
    const leaves = tree.leaves ?? "?";
    const height = tree.depth ?? "?";
    return `Features included: ${features} · Leaves: ${leaves} · Height: ${height}`;
  }

  function renderCompareBody(tree: TreeProfile, expanded = false) {
    if (compareView === "diagram") {
      if (tree.diagram?.nodes?.length) {
        return (
          <div className={expanded ? "compare-tree-diagram compare-tree-diagram--expanded" : "compare-tree-diagram"}>
            <TreeFlow nodes={tree.diagram.nodes} expanded={expanded} />
          </div>
        );
      }
      return (
        <Text size={expanded ? "md" : "xs"} c="dimmed">
          No diagram for this tree.
        </Text>
      );
    }
    return (
      <Stack gap={expanded ? 8 : 4}>
        {(tree.rules || []).map((rule) => (
          <Text key={rule} size={expanded ? "md" : "sm"} className="mono">
            {rule}
          </Text>
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap="md" className="step-flow">
      {onTimbertrekBest && (
        <TimberTrekPanel
          result={result}
          leftoverCount={leftover.length}
          banned={banned}
          keep={keep}
          busy={busy}
          onTimbertrek={onTimbertrekBest}
        />
      )}

      <div>
        <p className="section-label">Step 3</p>
        <h2 className="panel-head" style={{ margin: 0 }}>
          Browse Trees
        </h2>
        <Text size="sm" c="dimmed" mt={4}>
          Click a tree to select it. Compare a few if you want, then continue to score &amp; export.
        </Text>
      </div>

      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Text c="dimmed" size="sm" maw="100%">
          {leftover.length} surviving {leftover.length === 1 ? "tree" : "trees"}
          {result.n_trees ? ` · PRAXIS found ${result.n_trees.toLocaleString()} total` : ""} · showing{" "}
          {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, leftover.length)}
        </Text>
        <Group gap="sm" wrap="wrap" w={{ base: "100%", sm: "auto" }}>
          <Select
            size="xs"
            w={{ base: "100%", sm: 200 }}
            maw={280}
            label="Sort"
            value={ruleSort}
            onChange={(v) => v && setRuleSort(v as RuleSort)}
            data={[
              { value: "acc_desc", label: "Most accurate" },
              { value: "acc_asc", label: "Least accurate" },
              { value: "leaves_desc", label: "Most leaves" },
              { value: "leaves_asc", label: "Least leaves" },
              { value: "depth_desc", label: "Most height" },
              { value: "depth_asc", label: "Least height" },
            ]}
          />
          <Pagination total={pages} value={page} onChange={setPage} size="sm" />
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {slice.map((tree) => (
          <div
            key={tree.id}
            className={`rule-tile ${tree.id === selected.id ? "is-selected" : ""}`}
            onClick={() => setTreeId(tree.id)}
            onKeyDown={(e) => e.key === "Enter" && setTreeId(tree.id)}
            role="button"
            tabIndex={0}
          >
            <Group justify="space-between" wrap="wrap" align="flex-start" gap="xs">
              <Text fw={700}>
                Tree {tree.id}
              </Text>
              <Group gap="xs" wrap="wrap" justify="flex-end">
                <Badge variant="light" color="sea">
                  {tree.acc != null ? `${(tree.acc * 100).toFixed(1)}% accuracy` : `${tree.leaves ?? "?"} leaves`}
                </Badge>
                <Button
                  size="compact-xs"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTreeId(tree.id);
                    setExpandedTree(tree);
                  }}
                >
                  View
                </Button>
                <Button
                  size="compact-xs"
                  variant={compare.includes(tree.id) ? "filled" : "default"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCompare(tree.id);
                  }}
                >
                  {compare.includes(tree.id) ? "Comparing" : "Compare"}
                </Button>
              </Group>
            </Group>
            <p className="rule-tile-meta">{treeMeta(tree)}</p>
          </div>
        ))}
      </SimpleGrid>
      {compared.length >= 2 && (
        <div className="panel rise">
          <Group justify="space-between" mb="sm" wrap="wrap">
            <h2 className="panel-head" style={{ margin: 0 }}>
              Side by side
            </h2>
            <Group gap="xs">
              <Button
                size="compact-xs"
                variant={compareView === "diagram" ? "filled" : "default"}
                onClick={() => setCompareView("diagram")}
              >
                Illustration
              </Button>
              <Button
                size="compact-xs"
                variant={compareView === "text" ? "filled" : "default"}
                onClick={() => setCompareView("text")}
              >
                Text
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() => {
                  setCompare([]);
                  setExpandedTree(null);
                }}
              >
                Clear
              </Button>
            </Group>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            Scroll to zoom, drag to pan. Use Expand for a larger view.
          </Text>
          <SimpleGrid cols={{ base: 1, md: compared.length >= 3 ? 2 : compared.length }}>
            {compared.map((tree) => (
              <div key={tree.id} className={`rule-tile compare-tree ${tree.id === selected.id ? "is-selected" : ""}`}>
                <Group justify="space-between" mb={4} wrap="wrap">
                  <Text fw={600}>Tree {tree.id}</Text>
                  <Group gap="xs">
                    {tree.acc != null && (
                      <Badge variant="light" color="sea">
                        {(tree.acc * 100).toFixed(1)}%
                      </Badge>
                    )}
                    <Button size="compact-xs" variant="default" onClick={() => setExpandedTree(tree)}>
                      Expand
                    </Button>
                  </Group>
                </Group>
                <Text size="xs" c="dimmed" mb="sm">
                  {treeMeta(tree)}
                </Text>
                {renderCompareBody(tree)}
                {tree.id !== selected.id && (
                  <Button
                    size="compact-xs"
                    mt="sm"
                    variant="light"
                    onClick={() => setTreeId(tree.id)}
                  >
                    Use this one
                  </Button>
                )}
              </div>
            ))}
          </SimpleGrid>
        </div>
      )}

      <Modal
        opened={expandedTree !== null}
        onClose={() => setExpandedTree(null)}
        fullScreen
        title={
          expandedTree
            ? `Tree ${expandedTree.id}${
                expandedTree.acc != null ? ` · ${(expandedTree.acc * 100).toFixed(1)}% accuracy` : ""
              }`
            : undefined
        }
        padding="lg"
      >
        {expandedTree && (
          <Stack gap="md" maw={960} mx="auto">
            <Text size="sm" c="dimmed">
              {treeMeta(expandedTree)}
            </Text>
            {renderCompareBody(expandedTree, true)}
            {compareView === "diagram" && (expandedTree.rules?.length ?? 0) > 0 && (
              <Stack gap={6} mt="md">
                <Text size="sm" fw={600}>
                  If-then rules
                </Text>
                {(expandedTree.rules || []).map((rule) => (
                  <Text key={rule} size="sm" className="mono">
                    {rule}
                  </Text>
                ))}
              </Stack>
            )}
            <Group mt="md">
              {expandedTree.id !== selected.id && (
                <Button
                  variant="light"
                  onClick={() => {
                    setTreeId(expandedTree.id);
                    setExpandedTree(null);
                  }}
                >
                  Use this tree
                </Button>
              )}
              <Button variant="default" onClick={() => setExpandedTree(null)}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Group mt="md" wrap="wrap" className="cta-stack">
        <Button onClick={onContinue}>Continue to score &amp; export</Button>
      </Group>
    </Stack>
  );
}

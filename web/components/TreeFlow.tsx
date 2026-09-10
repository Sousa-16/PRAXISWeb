"use client";

import { useEffect, useMemo, memo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DiagramNode } from "@/lib/types";

type Props = {
  nodes: DiagramNode[];
  highlight?: string;
  expanded?: boolean;
};

type TreeNodeData = {
  label: string;
  hot: boolean;
  kind: "leaf" | "split";
};

const CELL_W = 168;
const CELL_H = 78;
const PAD = 28;

function truncateLabel(label: string) {
  return label.length > 22 ? `${label.slice(0, 20)}…` : label;
}

const TreeNode = memo(function TreeNode({ data }: NodeProps & { data: TreeNodeData }) {
  const leaf = data.kind === "leaf";
  const w = Math.min(150, Math.max(72, data.label.length * 7.2));
  return (
    <div
      className={`tree-flow-node ${leaf ? "tree-flow-node--leaf" : "tree-flow-node--split"}${
        data.hot ? " tree-flow-node--hot" : ""
      }`}
      style={{ width: w }}
    >
      <Handle type="target" position={Position.Top} className="tree-flow-handle" />
      <span className="tree-flow-node-label">{truncateLabel(data.label)}</span>
      <Handle type="source" position={Position.Bottom} className="tree-flow-handle" />
    </div>
  );
});

const nodeTypes = { leaf: TreeNode, split: TreeNode };

function diagramToFlow(nodes: DiagramNode[], highlight?: string): { nodes: Node[]; edges: Edge[] } {
  if (!nodes.length) return { nodes: [], edges: [] };

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const hl = highlight?.toLowerCase();

  const flowNodes: Node[] = nodes.map((n) => {
    const leaf = n.kind === "leaf";
    const hot = Boolean(hl && n.label.toLowerCase().includes(hl));
    const w = Math.min(150, Math.max(72, n.label.length * 7.2));
    return {
      id: String(n.id),
      type: n.kind,
      position: {
        x: PAD + (n.x - minX) * CELL_W + CELL_W / 2 - w / 2,
        y: PAD + (n.y - minY) * CELL_H,
      },
      data: { label: n.label, hot, kind: n.kind } satisfies TreeNodeData,
      draggable: false,
      selectable: false,
      connectable: false,
    };
  });

  const flowEdges: Edge[] = [];
  for (const n of nodes) {
    for (const childId of [n.left, n.right]) {
      if (childId === undefined) continue;
      flowEdges.push({
        id: `${n.id}-${childId}`,
        source: String(n.id),
        target: String(childId),
        type: "straight",
        focusable: false,
        interactionWidth: 0,
        style: { stroke: "var(--line)", strokeWidth: 1.75 },
      });
    }
  }

  return { nodes: flowNodes, edges: flowEdges };
}

function TreeFlowInner({ nodes, highlight, expanded }: Props) {
  const { fitView } = useReactFlow();
  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () => diagramToFlow(nodes, highlight),
    [nodes, highlight],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 0 });
    });
    return () => cancelAnimationFrame(id);
  }, [flowNodes, flowEdges, fitView, expanded]);

  return (
    <div className={expanded ? "tree-flow tree-flow--expanded" : "tree-flow"}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.15}
        maxZoom={2.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        nodesFocusable={false}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch
        panOnScroll={false}
        preventScrolling
        attributionPosition="bottom-right"
      >
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}

export function TreeFlow(props: Props) {
  if (!props.nodes.length) return null;
  return (
    <ReactFlowProvider>
      <TreeFlowInner {...props} />
    </ReactFlowProvider>
  );
}

"use client";

import { useMemo } from "react";
import type { DiagramNode } from "@/lib/types";

type Props = {
  nodes: DiagramNode[];
  highlight?: string;
  expanded?: boolean;
};

export function TreeSvg({ nodes, highlight, expanded }: Props) {
  const layout = useMemo(() => {
    if (!nodes.length) return null;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 28;
    const cellW = 168;
    const cellH = 78;
    const width = Math.max(320, (maxX - minX + 1) * cellW + pad * 2);
    const height = Math.max(180, (maxY - minY + 1) * cellH + pad * 2);
    const point = (n: DiagramNode) => ({
      x: pad + (n.x - minX) * cellW + cellW / 2,
      y: pad + (n.y - minY) * cellH + 22,
    });
    return { width, height, point };
  }, [nodes]);

  if (!layout) return null;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width="100%"
      role="img"
      aria-label="Decision tree"
      style={{ maxHeight: expanded ? "min(85vh, 960px)" : 420 }}
    >
      {nodes.map((n) => {
        const from = layout.point(n);
        const kids = [n.left, n.right].filter((id): id is number => id !== undefined);
        return kids.map((id) => {
          const child = byId.get(id);
          if (!child) return null;
          const to = layout.point(child);
          return (
            <line
              key={`${n.id}-${id}`}
              x1={from.x}
              y1={from.y + 14}
              x2={to.x}
              y2={to.y - 14}
              stroke="var(--line)"
              strokeWidth={1.75}
            />
          );
        });
      })}
      {nodes.map((n) => {
        const p = layout.point(n);
        const leaf = n.kind === "leaf";
        const hot = Boolean(highlight && n.label.toLowerCase().includes(highlight.toLowerCase()));
        const w = Math.min(150, Math.max(72, n.label.length * 7.2));
        return (
          <g key={n.id}>
            <rect
              x={p.x - w / 2}
              y={p.y - 16}
              width={w}
              height={32}
              rx={leaf ? 8 : 5}
              fill={leaf ? (hot ? "var(--copper)" : "var(--sea)") : "var(--panel-solid)"}
              stroke={leaf ? "transparent" : "var(--sea)"}
              strokeWidth={1.5}
            />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontSize={11}
              fontFamily="JetBrains Mono, monospace"
              fill={leaf ? "#fff" : "var(--ink)"}
            >
              {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

"use client";

import { RingProgress, Text } from "@mantine/core";
import type { ScoreOut } from "@/lib/types";

type Props = {
  score: ScoreOut;
  caption?: string;
};

export function PredictionBoard({ score, caption }: Props) {
  return (
    <div className="panel predict-board">
      <RingProgress
        size={118}
        thickness={11}
        roundCaps
        sections={[{ value: score.n ? (score.agree / score.n) * 100 : 0, color: "copper" }]}
        label={
          <Text ta="center" fw={700} className="mono" fz="sm">
            {score.agree}/{score.n}
          </Text>
        }
      />
      <div>
        <p className="section-label">Prediction</p>
        <p className="predict-value">{score.prediction}</p>
        <Text size="sm" c="dimmed">
          {caption ?? `${score.agree} of ${score.n} surviving rules agree on this case.`}
        </Text>
        {score.reason && score.reason.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Text size="sm" fw={600} mb={4}>
              Because
            </Text>
            {score.reason.map((r) => (
              <span key={r} className="reason-chip">
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

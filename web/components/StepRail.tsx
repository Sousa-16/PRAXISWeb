"use client";

import { STEPS } from "@/lib/constants";

type Props = {
  active: number;
  /** Highest step index the user may open (inclusive). */
  maxStep: number;
  onStep: (i: number) => void;
};

export function StepRail({ active, maxStep, onStep }: Props) {
  const fill = `${(active / Math.max(STEPS.length - 1, 1)) * 88}%`;
  return (
    <div className="rail">
      <div className="rail-fill" style={{ width: fill }} />
      {STEPS.map((s, i) => {
        const locked = i > maxStep;
        return (
          <button
            key={s.title}
            type="button"
            disabled={locked}
            className={`rail-step ${i === active ? "is-active" : ""} ${i < active ? "is-done" : ""} ${locked ? "is-locked" : ""}`}
            onClick={() => {
              if (!locked) onStep(i);
            }}
          >
            <span className="rail-idx">{i + 1}</span>
            <span className="rail-text">
              <b>{s.title}</b>
              <small>{s.detail}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { STEPS } from "@/lib/constants";

type Props = {
  active: number;
  onStep: (i: number) => void;
};

export function StepRail({ active, onStep }: Props) {
  const fill = `${(active / Math.max(STEPS.length - 1, 1)) * 88}%`;
  return (
    <div className="rail">
      <div className="rail-fill" style={{ width: fill }} />
      {STEPS.map((s, i) => (
        <button
          key={s.title}
          type="button"
          className={`rail-step ${i === active ? "is-active" : ""} ${i < active ? "is-done" : ""}`}
          onClick={() => onStep(i)}
        >
          <span className="rail-idx">{i + 1}</span>
          <span className="rail-text">
            <b>{s.title}</b>
            <small>{s.detail}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

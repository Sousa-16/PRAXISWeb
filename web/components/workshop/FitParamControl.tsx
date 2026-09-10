"use client";

import { NumberInput, Slider, Stack, Text } from "@mantine/core";
import {
  fitParamMarks,
  formatFitParamDisplay,
  snapFitParam,
  type FitParamKey,
} from "@/lib/fitParams";

type Props = {
  paramKey: FitParamKey;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** When true, value/min/max/step are percent units (e.g. 5 for 5%). */
  asPercent?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function FitParamControl({
  paramKey,
  label,
  description,
  value,
  min,
  max,
  step,
  asPercent = false,
  disabled = false,
  onChange,
}: Props) {
  const safeMax = Math.max(min, max);
  const displayValue = asPercent ? Math.round(value * 1000) / 10 : value;
  const displayMin = asPercent ? min * 100 : min;
  const displayMax = asPercent ? safeMax * 100 : safeMax;
  const displayStep = asPercent ? Math.max(step * 100, 0.1) : step;

  const marks = fitParamMarks(displayMin, displayMax, displayStep, (v) =>
    asPercent
      ? formatFitParamDisplay("rashomon_mult", v / 100, true)
      : formatFitParamDisplay(paramKey, v),
  );

  function commitDisplay(raw: number) {
    const snapped = snapFitParam(raw, displayStep);
    const clamped = Math.min(displayMax, Math.max(displayMin, snapped));
    onChange(asPercent ? clamped / 100 : clamped);
  }

  return (
    <Stack gap={6} className="fit-param">
      <div>
        <Text fw={600} size="sm">
          {label}
        </Text>
        <Text size="xs" c="dimmed" maw={640}>
          {description}
        </Text>
      </div>
      <div className="fit-param-row">
        <NumberInput
          className="fit-param-input"
          classNames={{ input: "fit-param-input-field" }}
          value={displayValue}
          onChange={(v) => {
            if (v === "" || v === undefined || v === null) return;
            commitDisplay(Number(v));
          }}
          min={displayMin}
          max={displayMax}
          step={displayStep}
          decimalScale={paramKey === "lambda_reg" ? 3 : asPercent ? 1 : 0}
          suffix={asPercent ? "%" : undefined}
          disabled={disabled}
          aria-label={label}
        />
        <Slider
          classNames={{
            root: "param-slider",
            track: "param-slider-track",
            bar: "param-slider-bar",
            thumb: "param-slider-thumb",
            mark: "param-slider-mark",
            markLabel: "param-slider-mark-label",
          }}
          value={displayValue}
          onChange={commitDisplay}
          min={displayMin}
          max={displayMax}
          step={displayStep}
          marks={marks}
          disabled={disabled || displayMax <= displayMin}
          label={null}
          thumbSize={16}
          color="copper"
          aria-label={`${label} slider`}
        />
      </div>
    </Stack>
  );
}

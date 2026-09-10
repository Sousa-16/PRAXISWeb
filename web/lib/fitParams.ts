/** PRAXIS search settings shown on Load a Table (defaults + bounds). */

export type FitParams = {
  lambda_reg: number;
  depth_budget: number;
  rashomon_mult: number;
  lookahead_k: number;
  fit_rows: number;
  max_trees: number;
};

export type FitParamKey = keyof FitParams;

export const DEFAULT_FIT_PARAMS: FitParams = {
  lambda_reg: 0.01,
  depth_budget: 5,
  rashomon_mult: 0.05,
  lookahead_k: 1,
  fit_rows: 2000,
  max_trees: 2000,
};

export const FIT_PARAM_BOUNDS: Record<
  FitParamKey,
  { min: number; max: number; step: number }
> = {
  lambda_reg: { min: 0.001, max: 0.1, step: 0.001 },
  depth_budget: { min: 2, max: 8, step: 1 },
  rashomon_mult: { min: 0, max: 0.2, step: 0.01 },
  lookahead_k: { min: 0, max: 7, step: 1 },
  fit_rows: { min: 100, max: 5000, step: 100 },
  max_trees: { min: 50, max: 5000, step: 50 },
};

export const FIT_PARAM_FIELDS: {
  key: FitParamKey;
  label: string;
  description: string;
}[] = [
  {
    key: "lambda_reg",
    label: "Prefer shorter rules",
    description:
      "How hard we push for shorter rules. Higher = fewer, simpler trees. Lower = more detailed trees allowed.",
  },
  {
    key: "depth_budget",
    label: "Longest chain of questions",
    description:
      "How many yes/no questions a single rule can chain. Deeper = more flexible, usually slower.",
  },
  {
    key: "rashomon_mult",
    label: "Keep near-best rules within",
    description:
      "Keep trees that score within this percent of the best one found. Larger = more trees to compare; smaller = a tighter shortlist.",
  },
  {
    key: "lookahead_k",
    label: "How carefully to search",
    description:
      "How carefully we search for good splits before building the set. 0 = fastest/greediest. Higher = stronger search, often slower. Cannot be higher than longest chain of questions minus 1.",
  },
  {
    key: "fit_rows",
    label: "Max rows used for training",
    description:
      "If your table is bigger than this, we randomly sample this many rows to train (keeps the search practical). Smaller = faster; larger = uses more of your data.",
  },
  {
    key: "max_trees",
    label: "Max trees to unpack for Browse",
    description:
      "After you set column rules, we fully unpack at most this many matching trees for the Browse step. Does not change how many PRAXIS found—only how many you see in detail.",
  },
];

export function clampFitParams(raw: Partial<FitParams>): FitParams {
  const next: FitParams = { ...DEFAULT_FIT_PARAMS, ...raw };
  (Object.keys(FIT_PARAM_BOUNDS) as FitParamKey[]).forEach((key) => {
    const { min, max } = FIT_PARAM_BOUNDS[key];
    let v = Number(next[key]);
    if (!Number.isFinite(v)) v = DEFAULT_FIT_PARAMS[key];
    next[key] = Math.min(max, Math.max(min, v));
  });
  next.depth_budget = Math.round(next.depth_budget);
  next.lookahead_k = Math.round(next.lookahead_k);
  next.fit_rows = Math.round(next.fit_rows);
  next.max_trees = Math.round(next.max_trees);
  const maxK = Math.max(0, next.depth_budget - 1);
  if (next.lookahead_k > maxK) next.lookahead_k = maxK;
  return next;
}

/** Snap a value to the parameter step (avoids float drift on the slider). */
export function snapFitParam(value: number, step: number): number {
  if (!Number.isFinite(value) || step <= 0) return value;
  const decimals = Math.max(0, (String(step).split(".")[1] || "").length);
  const snapped = Math.round(value / step) * step;
  return Number(snapped.toFixed(decimals));
}

/**
 * Discrete tick marks for a stepped slider.
 * Dense ranges get a thinned set of ticks; ends are always labeled.
 */
export function fitParamMarks(
  min: number,
  max: number,
  step: number,
  format: (v: number) => string,
  opts?: { maxTicks?: number; maxLabels?: number },
): { value: number; label?: string }[] {
  if (!(max > min) || step <= 0) {
    return [{ value: min, label: format(min) }];
  }
  const maxTicks = opts?.maxTicks ?? 11;
  const maxLabels = opts?.maxLabels ?? 6;
  const nSteps = Math.max(1, Math.round((max - min) / step));
  // Small ranges (depth, lookahead): tick + label every step.
  const tickStride = Math.max(1, Math.ceil(nSteps / (maxTicks - 1)));
  const labelStride =
    nSteps <= 8 ? tickStride : Math.max(tickStride, Math.ceil(nSteps / (maxLabels - 1)));
  const labelEvery = Math.ceil(labelStride / tickStride) * tickStride;

  const marks: { value: number; label?: string }[] = [];
  for (let i = 0; i <= nSteps; i += tickStride) {
    const value = snapFitParam(min + i * step, step);
    const atEnd = i === 0 || i >= nSteps;
    const labeled = atEnd || i % labelEvery === 0;
    marks.push(labeled ? { value, label: format(value) } : { value });
  }

  const last = marks[marks.length - 1];
  const end = snapFitParam(max, step);
  if (Math.abs(last.value - end) > step * 0.25) {
    marks.push({ value: end, label: format(end) });
  } else {
    marks[marks.length - 1] = { value: end, label: format(end) };
  }
  return marks;
}

export function formatFitParamDisplay(key: FitParamKey, value: number, asPercent = false): string {
  if (asPercent || key === "rashomon_mult") {
    const pct = Math.round(value * 1000) / 10;
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
  }
  if (key === "lambda_reg") return snapFitParam(value, 0.001).toFixed(3);
  return Math.round(value).toLocaleString();
}

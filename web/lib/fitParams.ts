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

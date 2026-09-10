export type ConstraintMode = "off" | "banned" | "keep";

export type DatasetPreview = {
  id: string;
  filename: string;
  n_rows: number;
  n_cols: number;
  columns: string[];
  guessed_label: string;
  class_counts: Record<string, number>;
  head: Record<string, string>[];
};

export type Feature = {
  id: string;
  label: string;
  frac: number;
  core: boolean;
};

export type DiagramNode = {
  id: number;
  x: number;
  y: number;
  kind: "leaf" | "split";
  label: string;
  left?: number;
  right?: number;
};

export type TreeProfile = {
  id: number;
  objective?: number;
  leaves?: number;
  depth?: number;
  splits?: string[];
  bases: string[];
  rules: string[];
  paths?: { name: string; true: boolean }[][];
  leaf_labels?: string[];
  acc?: number | null;
  diagram?: { nodes: DiagramNode[] };
};

export type JobResult = {
  file_rows: number;
  fit_rows: number;
  n_trees: number;
  n_profiled: number;
  n_matching?: number | null;
  n_scanned?: number;
  matching_note?: string | null;
  profiled?: boolean;
  min_objective?: number;
  acc_min?: number | null;
  acc_max?: number | null;
  jaccard?: number;
  class_names: string[];
  original_columns: string[];
  column_kinds: Record<string, string>;
  /** How many PRAXIS trees use each original column (0 = must-use matches nothing). */
  column_use?: Record<string, number>;
  column_codes: Record<string, Record<string, number>>;
  features: Feature[];
  trees: TreeProfile[];
  label: string;
  used_tgb?: boolean;
  params?: {
    lambda_reg: number;
    depth_budget: number;
    rashomon_mult: number;
    lookahead_k: number;
    fit_rows: number;
    max_trees: number;
  };
};

export type RuleSort =
  | "acc_desc"
  | "acc_asc"
  | "leaves_desc"
  | "leaves_asc"
  | "depth_desc"
  | "depth_asc";

export type Job = {
  id: string;
  dataset_id: string;
  label: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error?: string | null;
  result?: JobResult | null;
  params?: JobResult["params"] | null;
};

export type ScoreOut = {
  prediction: string;
  agree: number;
  n: number;
  rules: string[];
  reason?: string[];
  tree_id?: number;
  policy_id?: string;
};

export type ImpactGroup = {
  value: string;
  n: number;
  counts: Record<string, number>;
};

export type ImpactOut = {
  n: number;
  label?: string | null;
  class_names: string[];
  overall: Record<string, number>;
  group_by?: string | null;
  groups: ImpactGroup[];
};

export type Policy = {
  id?: string;
  name?: string;
  notes?: string;
  label?: string;
  class_names?: string[];
  tree: TreeProfile;
  ensemble?: TreeProfile[];
  constraints?: { banned: string[]; keep: string[] };
  maps?: {
    columns: string[];
    kind: Record<string, string>;
    codes: Record<string, Record<string, number>>;
  };
  binarizer?: Record<string, unknown>;
};

export type Me = {
  session_id: string;
  signed_in: boolean;
  guest_ttl_hours: number | null;
  max_rows: number;
  max_upload_bytes: number;
  fit_params?: {
    defaults: JobResult["params"];
    bounds: Record<string, { min: number; max: number }>;
  };
  notice: string;
};

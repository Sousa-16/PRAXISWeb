import type { DatasetPreview, ImpactOut, Job, JobResult, Me, Policy, ScoreOut } from "./types";

const JWT_KEY = "praxis_web_jwt";

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(JWT_KEY);
}

export function setJwt(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(JWT_KEY, token);
  else window.localStorage.removeItem(JWT_KEY);
}

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fromApi = typeof data.error === "string" ? data.error : typeof data.detail === "string" ? data.detail : "";
    const hint =
      res.status >= 500
        ? "The API on port 8765 did not answer. From the repo root, run it in WebApp/api, then try again."
        : `Request failed (${res.status})`;
    throw new Error(fromApi || hint);
  }
  return data;
}

function headers(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  const jwt = getJwt();
  if (jwt) h.set("Authorization", `Bearer ${jwt}`);
  return h;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: headers(init.headers),
  });
  return parse(res) as Promise<T>;
}

export const praxisWeb = {
  me: () => api<Me>("/v1/me"),
  attach: () => api<{ attached: number }>("/v1/auth/attach", { method: "POST" }),
  deleteMine: () => api<{ ok: boolean }>("/v1/me/data", { method: "DELETE" }),
  sample: () => api<DatasetPreview>("/v1/datasets/sample", { method: "POST" }),
  upload: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api<DatasetPreview>("/v1/datasets", { method: "POST", body });
  },
  createJob: (dataset_id: string, label: string) =>
    api<Job>("/v1/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id, label }),
    }),
  getJob: (id: string) => api<Job>(`/v1/jobs/${id}`),
  profileJob: (jobId: string, body: { banned: string[]; keep: string[]; max_trees?: number }) =>
    api<JobResult>(`/v1/jobs/${jobId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  matchCount: (jobId: string, body: { banned: string[]; keep: string[] }) =>
    api<{ n_matching: number; n_trees: number; indexed: boolean }>(`/v1/jobs/${jobId}/match_count`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  scoreJob: (jobId: string, body: { row: Record<string, string>; tree_id: number; banned: string[]; keep: string[] }) =>
    api<ScoreOut>(`/v1/jobs/${jobId}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  savePolicy: (body: {
    job_id: string;
    tree_id: number;
    banned: string[];
    keep: string[];
    name?: string;
    notes?: string;
  }) =>
    api<Policy>("/v1/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getPolicy: (id: string) => api<Policy>(`/v1/policies/${id}`),
  scorePolicy: (id: string, row: Record<string, string>) =>
    api<ScoreOut>(`/v1/policies/${id}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row }),
    }),
  scorePolicyBatch: async (id: string, file: File): Promise<string> => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/v1/policies/${id}/score_batch`, {
      method: "POST",
      body,
      credentials: "include",
      headers: headers(),
    });
    if (!res.ok) await parse(res);
    return res.text();
  },
  impact: (jobId: string, body: { tree_id: number; banned: string[]; keep: string[]; group_by?: string }) =>
    api<ImpactOut>(`/v1/jobs/${jobId}/impact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  downloadTimbertrek: async (
    jobId: string,
    body: {
      banned: string[];
      keep: string[];
      max_trees?: number;
      expand?: boolean;
      tree_ids?: number[];
      best_objective?: boolean;
    },
  ): Promise<{ blob: Blob; filename: string; nTrees: number; nExported: number }> => {
    const res = await fetch(`/v1/jobs/${jobId}/timbertrek`, {
      method: "POST",
      credentials: "include",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) await parse(res);
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = /filename="([^"]+)"/.exec(cd);
    return {
      blob,
      filename: match?.[1] || `timbertrek_${jobId}.json`,
      nTrees: Number(res.headers.get("X-PRAXIS-N-Trees") || 0),
      nExported: Number(res.headers.get("X-PRAXIS-N-Exported") || 0),
    };
  },
  search: (q: string) =>
    api<{
      policies: { id: string; job_id: string; tree_id: number; name?: string }[];
    }>(`/v1/search?q=${encodeURIComponent(q)}`),
};

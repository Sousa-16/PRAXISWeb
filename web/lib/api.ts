import type { DatasetPreview, ImpactOut, Job, JobResult, Me, Policy, ScoreOut } from "./types";

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fromApi = typeof data.error === "string" ? data.error : typeof data.detail === "string" ? data.detail : "";
    const hint =
      res.status === 429
        ? "The demo is busy. Wait a moment and try again."
        : res.status >= 500
          ? "The demo is temporarily unavailable. Try again in a moment."
          : `Request failed (${res.status})`;
    throw new Error(fromApi || hint);
  }
  return data;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: init.headers,
  });
  return parse(res) as Promise<T>;
}

export const praxisWeb = {
  me: () => api<Me>("/v1/me"),
  deleteMine: () => api<{ ok: boolean }>("/v1/me/data", { method: "DELETE" }),
  sample: () => api<DatasetPreview>("/v1/datasets/sample", { method: "POST" }),
  upload: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api<DatasetPreview>("/v1/datasets", { method: "POST", body });
  },
  createJob: (dataset_id: string, label: string, params?: Record<string, number>) =>
    api<Job>("/v1/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params ? { dataset_id, label, params } : { dataset_id, label }),
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
  freezeJob: (jobId: string, body: { tree_id: number; banned: string[]; keep: string[] }) =>
    api<Policy>(`/v1/jobs/${jobId}/freeze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  scoreJobBatch: async (
    jobId: string,
    file: File,
    body: { tree_id: number; banned: string[]; keep: string[] },
  ): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    form.append("tree_id", String(body.tree_id));
    form.append("banned", JSON.stringify(body.banned));
    form.append("keep", JSON.stringify(body.keep));
    const res = await fetch(`/v1/jobs/${jobId}/score_batch`, {
      method: "POST",
      body: form,
      credentials: "include",
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
      headers: { "Content-Type": "application/json" },
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
};

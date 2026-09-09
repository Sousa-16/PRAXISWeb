"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { praxisWeb } from "@/lib/api";
import { COMPILE_MSGS, PAGE_SIZE, START_EVENT } from "@/lib/constants";
import { clearWorkshopStore, loadWorkshopStore, saveWorkshopStore } from "@/lib/sessionStore";
import { bestAccuracy, remainingTrees, sortTrees } from "@/lib/trees";
import type {
  ConstraintMode,
  DatasetPreview,
  ImpactOut,
  Job,
  JobResult,
  Me,
  RuleSort,
  ScoreOut,
  TreeProfile,
} from "@/lib/types";

export function useWorkshop() {
  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState(0);
  const [dataset, setDataset] = useState<DatasetPreview | null>(null);
  const [label, setLabel] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [banned, setBanned] = useState<string[]>([]);
  const [keep, setKeep] = useState<string[]>([]);
  const [treeId, setTreeId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [row, setRow] = useState<Record<string, string>>({});
  const [score, setScore] = useState<ScoreOut | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warnOwn, setWarnOwn] = useState(false);
  const [compare, setCompare] = useState<number[]>([]);
  const [polName, setPolName] = useState("");
  const [polNotes, setPolNotes] = useState("");
  const [impact, setImpact] = useState<ImpactOut | null>(null);
  const [impactCol, setImpactCol] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [ruleSort, setRuleSort] = useState<RuleSort>("acc_desc");
  const [profiling, setProfiling] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [matchCounting, setMatchCounting] = useState(false);
  const [matchCountStale, setMatchCountStale] = useState(false);
  const bootGen = useRef(0);

  const refreshMe = useCallback(() => {
    praxisWeb.me().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refreshMe();
    const gen = ++bootGen.current;
    const stored = loadWorkshopStore();
    if (stored.dataset) {
      setDataset(stored.dataset);
      setLabel(stored.label || stored.dataset.guessed_label);
    }
    if (stored.banned) setBanned(stored.banned);
    if (stored.keep) setKeep(stored.keep);
    if (stored.treeId != null) setTreeId(stored.treeId);
    if (stored.step) setStep(stored.step);
    if (stored.jobId) {
      praxisWeb
        .getJob(stored.jobId)
        .then((j) => {
          if (bootGen.current === gen) setJob(j);
        })
        .catch(() => undefined);
    }
  }, [refreshMe]);

  useEffect(() => {
    const onStart = () => {
      bootGen.current += 1;
      setDataset(null);
      setLabel("");
      setJob(null);
      setBanned([]);
      setKeep([]);
      setTreeId(null);
      setPage(1);
      setRow({});
      setScore(null);
      setPolicyId(null);
      setWarnOwn(false);
      setCompare([]);
      setPolName("");
      setPolNotes("");
      setImpact(null);
      setImpactCol(null);
      setStep(0);
      clearWorkshopStore();
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (!dataset && !job) return;
    saveWorkshopStore({
      dataset: dataset ?? undefined,
      label,
      jobId: job?.id,
      banned,
      keep,
      treeId: treeId ?? undefined,
      step,
    });
  }, [dataset, label, job, banned, keep, treeId, step]);

  useEffect(() => {
    if (!job?.id) return;
    if (job.status !== "queued" && job.status !== "running") return;
    let stop = false;
    const tick = () => {
      praxisWeb
        .getJob(job.id)
        .then((j) => {
          if (!stop) setJob(j);
        })
        .catch(() => undefined);
    };
    tick();
    const t = window.setInterval(tick, 1200);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [job?.id, job?.status]);

  const compiling = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    if (!compiling) return;
    const t = window.setInterval(() => setMsgIdx((i) => (i + 1) % COMPILE_MSGS.length), 2200);
    return () => window.clearInterval(t);
  }, [compiling]);

  const result: JobResult | null = job?.status === "succeeded" && job.result ? job.result : null;
  const leftover = useMemo(() => {
    if (!result?.trees?.length) return [];
    const filtered = remainingTrees(result.trees, banned, keep);
    return sortTrees(filtered, ruleSort);
  }, [result, banned, keep, ruleSort]);
  const pages = Math.max(1, Math.ceil(leftover.length / PAGE_SIZE));
  const slice = leftover.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected: TreeProfile | undefined = leftover.find((t) => t.id === treeId) || leftover[0];
  const bestAll = useMemo(() => (result?.trees?.length ? bestAccuracy(result.trees) : null), [result]);
  const bestLeft = useMemo(() => bestAccuracy(leftover), [leftover]);
  const constrained = banned.length > 0 || keep.length > 0;
  const compared = useMemo(() => leftover.filter((t) => compare.includes(t.id)), [leftover, compare]);
  const columns = result?.original_columns || (dataset ? dataset.columns.filter((c) => c !== label) : []);
  const required = selected?.bases || [];
  const impactClasses = impact
    ? impact.class_names.length
      ? impact.class_names
      : Object.keys(impact.overall)
    : [];
  const profiled = Boolean(result?.profiled && (result.trees?.length ?? 0) > 0);

  useEffect(() => {
    if (selected && selected.id !== treeId) setTreeId(selected.id);
  }, [selected, treeId]);

  useEffect(() => {
    setPage(1);
  }, [ruleSort]);

  useEffect(() => {
    setPage(1);
    setScore(null);
    setPolicyId(null);
    setCompare([]);
    setImpact(null);
  }, [banned, keep]);

  useEffect(() => {
    if (!job || job.status !== "succeeded" || !result || step !== 1) return;
    let cancelled = false;
    // Instant UI for empty / full-ban cases; otherwise debounce the API count.
    if (!banned.length && !keep.length) {
      setMatchCount(result.n_trees);
      setMatchCounting(false);
      setMatchCountStale(false);
      return;
    }
    setMatchCounting(true);
    const timer = window.setTimeout(() => {
      praxisWeb
        .matchCount(job.id, { banned, keep })
        .then((out) => {
          if (!cancelled) {
            setMatchCount(out.n_matching);
            setMatchCountStale(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMatchCount(null);
            setMatchCountStale(true);
          }
        })
        .finally(() => {
          if (!cancelled) setMatchCounting(false);
        });
    }, banned.length + keep.length > 20 ? 40 : 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [job, result, step, banned, keep]);

  async function profileAndContinue() {
    if (!job) return;
    setProfiling(true);
    setBusy(true);
    try {
      const next = await praxisWeb.profileJob(job.id, { banned, keep });
      setJob({ ...job, result: next, status: "succeeded" });
      setTreeId(null);
      setPage(1);
      setStep(2);
      notifications.show({
        title: "Rules ready",
        message: `Showing ${next.n_profiled} of ${next.n_trees.toLocaleString()} trees found by PRAXIS.`,
        color: "copper",
      });
    } catch (err) {
      notifications.show({ title: "Could not profile trees", message: String(err), color: "red" });
    } finally {
      setProfiling(false);
      setBusy(false);
    }
  }

  function modeOf(col: string): ConstraintMode {
    if (banned.includes(col)) return "banned";
    if (keep.includes(col)) return "keep";
    return "off";
  }

  function setMode(col: string, mode: ConstraintMode) {
    setBanned((b) => b.filter((c) => c !== col).concat(mode === "banned" ? [col] : []));
    setKeep((k) => k.filter((c) => c !== col).concat(mode === "keep" ? [col] : []));
  }

  function toggleCompare(id: number) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  }

  async function useSample() {
    setBusy(true);
    try {
      const ds = await praxisWeb.sample();
      setDataset(ds);
      setLabel(ds.guessed_label);
      setJob(null);
      setBanned([]);
      setKeep([]);
      setStep(0);
      notifications.show({
        title: "Sample email spam loaded",
        message: `${ds.n_rows} rows. Next: pick the label and search.`,
        color: "copper",
      });
    } catch (err) {
      notifications.show({ title: "Could not load sample", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setWarnOwn(true);
    setBusy(true);
    try {
      const ds = await praxisWeb.upload(file);
      setDataset(ds);
      setLabel(ds.guessed_label);
      setJob(null);
      setBanned([]);
      setKeep([]);
      setStep(0);
    } catch (err) {
      notifications.show({ title: "Upload failed", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function startSearch() {
    if (!dataset) return;
    setBusy(true);
    try {
      const created = await praxisWeb.createJob(dataset.id, label);
      setJob(created);
      notifications.show({
        title: "Search started",
        message: "This can take a minute. Stay on this page.",
        color: "copper",
      });
    } catch (err) {
      notifications.show({ title: "Could not start search", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function continueToSave() {
    setStep(3);
  }

  async function simulate() {
    if (!job || !selected) return;
    setBusy(true);
    try {
      const out = await praxisWeb.scoreJob(job.id, { row, tree_id: selected.id, banned, keep });
      setScore(out);
      setStep(3);
    } catch (err) {
      notifications.show({ title: "Could not score this row", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy() {
    if (!job || !selected) return;
    setBusy(true);
    try {
      const policy = await praxisWeb.savePolicy({
        job_id: job.id,
        tree_id: selected.id,
        banned,
        keep,
        name: polName.trim(),
        notes: polNotes.trim(),
      });
      setPolicyId(policy.id || null);
      notifications.show({
        title: "Policy saved",
        message: policy.name ? `“${policy.name}” (${policy.id})` : policy.id ? `id ${policy.id}` : "Saved.",
        color: "copper",
      });
    } catch (err) {
      notifications.show({ title: "Could not save", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function previewImpact() {
    if (!job || !selected) return;
    setBusy(true);
    try {
      setImpact(
        await praxisWeb.impact(job.id, {
          tree_id: selected.id,
          banned,
          keep,
          group_by: impactCol || "",
        }),
      );
    } catch (err) {
      notifications.show({ title: "Could not preview impact", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  function resetImpact() {
    setImpact(null);
    setImpactCol(null);
  }

  async function downloadTimbertrekBest(expand = false) {
    if (!job || !result) return;
    setBusy(true);
    try {
      const { downloadBlob } = await import("@/lib/download");
      const out = await praxisWeb.downloadTimbertrek(job.id, {
        banned,
        keep,
        max_trees: expand ? 5000 : 2000,
        expand: true,
      });
      downloadBlob(out.filename, out.blob);
      notifications.show({
        title: "TimberTrek JSON ready",
        message: `Exported ${out.nExported.toLocaleString()} trees matching your Set Tree Rules choices (of ${out.nTrees.toLocaleString()} PRAXIS found).`,
        color: "copper",
      });
    } catch (err) {
      notifications.show({ title: "Could not export TimberTrek JSON", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    if (!window.confirm("Delete every upload, search, and policy for this browser (or account)?")) return;
    await praxisWeb.deleteMine();
    setDataset(null);
    setJob(null);
    setBanned([]);
    setKeep([]);
    setScore(null);
    setPolicyId(null);
    clearWorkshopStore();
    refreshMe();
    notifications.show({ title: "Deleted", message: "Your rows on this server are gone.", color: "copper" });
  }

  return {
    me,
    step,
    setStep,
    dataset,
    label,
    setLabel,
    job,
    banned,
    keep,
    treeId,
    setTreeId,
    page,
    setPage,
    row,
    setRow,
    score,
    policyId,
    busy,
    warnOwn,
    compare,
    setCompare,
    polName,
    setPolName,
    polNotes,
    setPolNotes,
    impact,
    impactCol,
    setImpactCol,
    msgIdx,
    compiling,
    profiling,
    profiled,
    matchCount,
    matchCounting,
    matchCountStale,
    setMatchCount,
    setMatchCounting,
    ruleSort,
    setRuleSort,
    result,
    leftover,
    pages,
    slice,
    selected,
    bestAll,
    bestLeft,
    constrained,
    compared,
    columns,
    required,
    impactClasses,
    refreshMe,
    modeOf,
    setMode,
    toggleCompare,
    useSample,
    onUpload,
    startSearch,
    simulate,
    continueToSave,
    profileAndContinue,
    savePolicy,
    previewImpact,
    resetImpact,
    downloadTimbertrekBest,
    wipe,
    setBanned,
    setKeep,
  };
}

export type WorkshopApi = ReturnType<typeof useWorkshop>;

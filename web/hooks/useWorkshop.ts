"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { praxisWeb } from "@/lib/api";
import { COMPILE_MSGS, PAGE_SIZE, START_EVENT } from "@/lib/constants";
import { DEFAULT_FIT_PARAMS, clampFitParams, type FitParams } from "@/lib/fitParams";
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
  const [fitParams, setFitParamsState] = useState<FitParams>({ ...DEFAULT_FIT_PARAMS });
  const [job, setJob] = useState<Job | null>(null);
  const [banned, setBanned] = useState<string[]>([]);
  const [keep, setKeep] = useState<string[]>([]);
  const [treeId, setTreeId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [row, setRow] = useState<Record<string, string>>({});
  const [score, setScore] = useState<ScoreOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [warnOwn, setWarnOwn] = useState(false);
  const [compare, setCompare] = useState<number[]>([]);
  const [impact, setImpact] = useState<ImpactOut | null>(null);
  const [impactCol, setImpactCol] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [ruleSort, setRuleSort] = useState<RuleSort>("acc_desc");
  const [profiling, setProfiling] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [matchCounting, setMatchCounting] = useState(false);
  const [matchCountStale, setMatchCountStale] = useState(false);
  const bootGen = useRef(0);

  function setFitParams(next: FitParams) {
    setFitParamsState(clampFitParams(next));
  }

  function clearJobState() {
    setJob(null);
    setBanned([]);
    setKeep([]);
    setTreeId(null);
    setPage(1);
    setRow({});
    setScore(null);
    setCompare([]);
    setImpact(null);
    setImpactCol(null);
  }

  function applyDataset(ds: DatasetPreview) {
    setDataset(ds);
    setLabel(ds.guessed_label);
    clearJobState();
    setStep(0);
  }

  function resetWorkshop() {
    bootGen.current += 1;
    setDataset(null);
    setLabel("");
    clearJobState();
    setWarnOwn(false);
    setStep(0);
    clearWorkshopStore();
  }

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
          if (bootGen.current !== gen) return;
          setJob(j);
        })
        .catch((err: unknown) => {
          if (bootGen.current !== gen) return;
          const msg = err instanceof Error ? err.message : String(err);
          if (!/unknown job|not found/i.test(msg)) return;
          clearWorkshopStore();
          setDataset(null);
          setLabel("");
          clearJobState();
          setStep(0);
          notifications.show({
            color: "yellow",
            message: "Your previous search expired. Load a table to start again.",
          });
        });
    }
  }, [refreshMe]);

  useEffect(() => {
    const onStart = () => resetWorkshop();
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
      const next = await praxisWeb.profileJob(job.id, {
        banned,
        keep,
        max_trees: fitParams.max_trees,
      });
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
      applyDataset(ds);
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
      applyDataset(ds);
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
      const created = await praxisWeb.createJob(dataset.id, label, fitParams);
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

  async function continueToScore() {
    setStep(3);
  }

  async function simulate() {
    if (!job || !selected) return;
    setBusy(true);
    try {
      const out = await praxisWeb.scoreJob(job.id, { row, tree_id: selected.id, banned, keep });
      setScore(out);
    } catch (err) {
      notifications.show({ title: "Could not score this row", message: String(err), color: "red" });
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

  function resetConstraints() {
    setBanned([]);
    setKeep([]);
    setMatchCount(result?.n_trees ?? null);
    setMatchCounting(false);
  }

  function hideAllColumns() {
    setBanned(columns);
    setKeep([]);
    setMatchCount(0);
    setMatchCounting(true);
  }

  async function downloadTimbertrekBest() {
    if (!job || !result) return;
    setBusy(true);
    try {
      const { downloadBlob } = await import("@/lib/download");
      const out = await praxisWeb.downloadTimbertrek(job.id, {
        banned,
        keep,
        max_trees: 2000,
        expand: leftover.length === 0,
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
    if (!window.confirm("Delete every upload and search for this browser?")) return;
    // Clear the workshop immediately so Delete feels instant even if a fit is running.
    resetWorkshop();
    notifications.show({
      title: "Deleted",
      message: "Your rows on this server are gone. Any search in progress was cancelled.",
      color: "copper",
    });
    try {
      await praxisWeb.deleteMine();
      refreshMe();
    } catch (err) {
      notifications.show({
        title: "Could not finish deleting on the server",
        message: String(err),
        color: "red",
      });
      refreshMe();
    }
  }

  const maxStep = !dataset ? 0 : !result ? 0 : !selected ? 2 : 3;

  return {
    me,
    step,
    setStep,
    maxStep,
    dataset,
    label,
    setLabel,
    fitParams,
    setFitParams,
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
    busy,
    warnOwn,
    compare,
    setCompare,
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
    resetConstraints,
    hideAllColumns,
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
    continueToScore,
    profileAndContinue,
    previewImpact,
    resetImpact,
    downloadTimbertrekBest,
    wipe,
  };
}

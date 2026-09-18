"use client";

import { useEffect } from "react";
import { Alert, Button, Text } from "@mantine/core";
import { AppShell } from "@/components/AppShell";
import { StepRail } from "@/components/StepRail";
import { Hero } from "@/components/workshop/Hero";
import { StepHide } from "@/components/workshop/StepHide";
import { StepLoad } from "@/components/workshop/StepLoad";
import { StepScore } from "@/components/workshop/StepScore";
import { StepTry } from "@/components/workshop/StepTry";
import { GUEST_FOOTER } from "@/lib/constants";
import { useWorkshop } from "@/hooks/useWorkshop";

function scrollPageToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export default function HomePage() {
  const w = useWorkshop();

  // Land at the top on first open; don't let the browser restore a mid-page scroll.
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    scrollPageToTop();
  }, []);

  // Each workshop step (and leaving the hero after load) should start at the top.
  useEffect(() => {
    scrollPageToTop();
  }, [w.step, w.dataset]);

  return (
    <AppShell
      topRight={
        <Button size="xs" color="red" variant="subtle" onClick={w.wipe}>
          Delete my data
        </Button>
      }
    >
      {!w.dataset && <Hero busy={w.busy} onSample={w.useSample} onUpload={w.onUpload} />}

      {w.dataset && (
        <StepRail
          active={w.step}
          maxStep={w.maxStep}
          onStep={(i) => w.setStep(Math.min(i, w.maxStep))}
        />
      )}

      {w.step === 0 && w.dataset && (
        <StepLoad
          dataset={w.dataset}
          label={w.label}
          setLabel={w.setLabel}
          fitParams={w.fitParams}
          setFitParams={w.setFitParams}
          warnOwn={w.warnOwn}
          busy={w.busy}
          compiling={w.compiling}
          msgIdx={w.msgIdx}
          job={w.job}
          result={w.result}
          maxRows={w.me?.max_rows}
          maxUploadBytes={w.me?.max_upload_bytes}
          onSearch={w.startSearch}
          onUpload={w.onUpload}
          onContinue={() => w.setStep(1)}
        />
      )}

      {w.step === 1 && w.result && (
        <StepHide
          result={w.result}
          leftoverCount={w.leftover.length}
          matchCount={w.matchCount}
          matchCounting={w.matchCounting}
          matchCountStale={w.matchCountStale}
          columns={w.columns}
          constrained={w.constrained}
          bestAll={w.bestAll}
          bestLeft={w.bestLeft}
          profiled={w.profiled}
          profiling={w.profiling}
          modeOf={w.modeOf}
          setMode={w.setMode}
          onReset={w.resetConstraints}
          onHideAll={w.hideAllColumns}
          onContinue={w.profileAndContinue}
        />
      )}

      {w.step === 2 && w.result && w.selected && (
        <StepTry
          result={w.result}
          leftover={w.leftover}
          slice={w.slice}
          selected={w.selected}
          page={w.page}
          pages={w.pages}
          setPage={w.setPage}
          ruleSort={w.ruleSort}
          setRuleSort={w.setRuleSort}
          compare={w.compare}
          compared={w.compared}
          toggleCompare={w.toggleCompare}
          setCompare={w.setCompare}
          setTreeId={w.setTreeId}
          busy={w.busy}
          onContinue={w.continueToScore}
          banned={w.banned}
          keep={w.keep}
          onTimbertrekBest={w.downloadTimbertrekBest}
        />
      )}

      {w.step === 3 && w.selected && (
        <StepScore
          selected={w.selected}
          score={w.score}
          result={w.result}
          leftover={w.leftover}
          banned={w.banned}
          keep={w.keep}
          jobId={w.job?.id}
          columns={w.columns}
          row={w.row}
          setRow={w.setRow}
          scoreCols={w.required}
          maxRows={w.me?.max_rows}
          impact={w.impact}
          impactCol={w.impactCol}
          setImpactCol={w.setImpactCol}
          impactClasses={w.impactClasses}
          busy={w.busy}
          onScore={w.simulate}
          onImpact={w.previewImpact}
          onResetImpact={w.resetImpact}
        />
      )}

      {w.step > 0 && !w.result && (
        <Alert color="yellow" variant="light" mt="lg">
          Load a table and wait for the search to finish first.
        </Alert>
      )}

      {w.me && (
        <Text size="xs" c="dimmed" ta="center" mt={48} maw={640} mx="auto">
          {GUEST_FOOTER.replace("{hours}", String(w.me.guest_ttl_hours ?? 24))}{" "}
          <Text component="a" href="/privacy" size="xs" c="copper" inherit>
            Privacy
          </Text>
        </Text>
      )}
    </AppShell>
  );
}

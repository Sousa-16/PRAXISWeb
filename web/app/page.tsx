"use client";

import { Alert, Button, Group, Text } from "@mantine/core";
import { AppShell } from "@/components/AppShell";
import { AuthBar } from "@/components/AuthBar";
import { StepRail } from "@/components/StepRail";
import { Hero } from "@/components/workshop/Hero";
import { StepHide } from "@/components/workshop/StepHide";
import { StepLoad } from "@/components/workshop/StepLoad";
import { StepSave } from "@/components/workshop/StepSave";
import { StepTry } from "@/components/workshop/StepTry";
import { useWorkshop } from "@/hooks/useWorkshop";

export default function HomePage() {
  const w = useWorkshop();

  return (
    <AppShell
      topRight={
        <Group gap="xs" wrap="wrap">
          <AuthBar signedIn={Boolean(w.me?.signed_in)} onChange={w.refreshMe} />
          <Button size="xs" color="red" variant="subtle" onClick={w.wipe}>
            Delete my data
          </Button>
        </Group>
      }
    >
      {!w.dataset && <Hero busy={w.busy} onSample={w.useSample} onUpload={w.onUpload} />}

      {w.dataset && <StepRail active={w.step} onStep={w.setStep} />}

      {w.step === 0 && w.dataset && (
        <StepLoad
          dataset={w.dataset}
          label={w.label}
          setLabel={w.setLabel}
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
          onReset={() => {
            w.setBanned([]);
            w.setKeep([]);
            w.setMatchCount(w.result?.n_trees ?? null);
            w.setMatchCounting(false);
          }}
          onHideAll={() => {
            w.setBanned(w.columns);
            w.setKeep([]);
            // Optimistic: banning every original column leaves only featureless trees (usually 0).
            w.setMatchCount(0);
            w.setMatchCounting(true);
          }}
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
          row={w.row}
          setRow={w.setRow}
          required={w.required}
          busy={w.busy}
          onScore={w.simulate}
          onContinue={w.continueToSave}
          banned={w.banned}
          keep={w.keep}
          onTimbertrekBest={w.downloadTimbertrekBest}
        />
      )}

      {w.step === 3 && w.selected && (
        <StepSave
          selected={w.selected}
          score={w.score}
          result={w.result}
          leftover={w.leftover}
          banned={w.banned}
          keep={w.keep}
          jobId={w.job?.id}
          columns={w.columns}
          impact={w.impact}
          impactCol={w.impactCol}
          setImpactCol={w.setImpactCol}
          impactClasses={w.impactClasses}
          busy={w.busy}
          onImpact={w.previewImpact}
          onResetImpact={w.resetImpact}
          polName={w.polName}
          setPolName={w.setPolName}
          polNotes={w.polNotes}
          setPolNotes={w.setPolNotes}
          onSave={w.savePolicy}
          policyId={w.policyId}
        />
      )}

      {w.step > 0 && !w.result && (
        <Alert color="yellow" variant="light" mt="lg">
          Load a table and wait for the search to finish first.
        </Alert>
      )}

      {w.me && (
        <Text size="xs" c="dimmed" ta="center" mt={48} maw={640} mx="auto">
          Uploads are tied to this browser (or your account). Guest data expires after{" "}
          {w.me.guest_ttl_hours ?? 24} hours. Do not upload secrets on the web app.
        </Text>
      )}
    </AppShell>
  );
}

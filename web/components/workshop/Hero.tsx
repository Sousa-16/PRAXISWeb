"use client";

import { Button, FileButton } from "@mantine/core";

type Props = {
  busy: boolean;
  onSample: () => void;
  onUpload: (file: File | null) => void;
};

export function Hero({ busy, onSample, onUpload }: Props) {
  return (
    <>
      <section className="hero">
        <div className="hero-visual" aria-hidden>
          <div className="tree-ring" />
          <div className="tree-ring" />
          <div className="tree-ring" />
          <div className="tree-core" />
        </div>
        <h1 className="hero-brand rise">
          PRAXIS <span>Web</span>
        </h1>
        <p className="hero-line rise rise-1">
          Fast, memory-efficient, and transparent AI Decision Automation tailored to your exact
          business constraints.
        </p>
        <p className="hero-sub rise rise-2">
          Powered by PRAXIS: an innovative algorithm achieving orders-of-magnitude improvements in
          both runtime and memory efficiency compared to state-of-the-art methods, without
          sacrificing interpretability.
        </p>
        <div className="hero-ctas rise rise-3">
          <Button size="lg" fullWidth onClick={onSample} loading={busy}>
            Use Sample Email Spam Detection
          </Button>
          <FileButton onChange={onUpload} accept=".csv,text/csv">
            {(props) => (
              <Button {...props} size="lg" fullWidth variant="default" loading={busy}>
                Upload CSV
              </Button>
            )}
          </FileButton>
        </div>
      </section>

      <section className="primer rise rise-2" aria-labelledby="primer-heading">
        <p className="section-label">The engine</p>
        <h2 id="primer-heading" className="panel-head">
          What is PRAXIS?
        </h2>
        <p className="primer-lead">
          For many datasets there is not one “best” model, but many. The collection of these many
          decision trees that predict almost equally well is what is called the{" "}
          <strong>Rashomon Set</strong>. That set is gold for real decisions that need to be explained
          and monitored in industries such as law, business, and healthcare (fairness, which columns you
          are allowed to use later, domain rules); however, computing these transparent models used to
          take huge memory and runtime. Developed by researchers from Duke University and the University
          of British Columbia, <strong>PRAXIS</strong> (Proxy-guided Rashomon set ApproXimatIonS) is an
          algorithm that finds that set of near-optimal sparse trees with exponentially better speed and
          memory, while still recovering nearly the full set. For more details, visit the{" "}
          <a href="https://arxiv.org/abs/2606.00202" target="_blank" rel="noopener noreferrer">
            PRAXIS ICML 2026 paper
          </a>
          .
        </p>

        <p className="section-label" style={{ marginTop: "1.5rem" }}>
          Why PRAXIS
        </p>
        <h2 className="panel-head">Advantages and innovation</h2>
        <div className="primer-grid">
          <div>
            <h3 className="primer-term">Orders of magnitude faster</h3>
            <p>
              Exact Rashomon solvers for decision trees can run for hours or run out of memory. PRAXIS
              uses a strong proxy to prune the search and routinely finishes in seconds to minutes on the
              same problems, without giving up nearly all of the trees.
            </p>
          </div>
          <div>
            <h3 className="primer-term">Near-complete recovery</h3>
            <p>
              Approximation usually means missing models. Empirically PRAXIS recovers almost the entire
              Rashomon set relative to optimal methods, so you can trust the options you see, not a
              thin random sample.
            </p>
          </div>
          <div>
            <h3 className="primer-term">Sparse, readable trees</h3>
            <p>
              Every candidate is a short if-then decision tree you can draw, audit, and explain. No neural
              nets, no black-box scores: just branches on your columns and a leaf prediction.
            </p>
          </div>
          <div>
            <h3 className="primer-term">Secondary goals become easy</h3>
            <p>
              Once the near-best set exists, you can prefer trees that avoid banned columns, require
              others, improve fairness, or match domain structure by filtering the set, not by rewriting
              a loss function and retraining from scratch.
            </p>
          </div>
          <div>
            <h3 className="primer-term">Shows model diversity</h3>
            <p>
              Different near-best trees often use different features. Seeing that diversity quantifies
              uncertainty and helps you pick a policy that matches how your organization actually works.
            </p>
          </div>
          <div>
            <h3 className="primer-term">Built for real tables</h3>
            <p>
              PRAXIS is designed so researchers and practitioners can model Rashomon sets on practical
              datasets that older exact enumerators could not finish: the foundation this website runs
              on.
            </p>
          </div>
        </div>

        <p className="section-label" style={{ marginTop: "1.5rem" }}>
          This website
        </p>
        <h2 className="panel-head">What PRAXIS Web does for you</h2>
        <p className="primer-lead">
          PRAXIS Web is a workshop on top of that algorithm. Upload a labeled CSV; PRAXIS searches for
          the near-best rules; you hide columns you will not have later, try a case, compare survivors,
          score new rows, and download a frozen rule (JSON or a standalone Python scorer). After you
          start, the screens stick to everyday words: table, columns, rules, accuracy.
        </p>

        <ol className="primer-steps">
          <li>
            <strong>Load a Table</strong>: choose the label column; PRAXIS searches for many good short
            rules.
          </li>
          <li>
            <strong>Set Tree Rules</strong>: mark fields as either, won’t-have, or must-use. Surviving rules
            update live, with the accuracy trade-off shown.
          </li>
          <li>
            <strong>Browse Trees</strong>: choose among surviving trees; optionally try one row,
            or skip straight to score &amp; export.
          </li>
          <li>
            <strong>Score &amp; export</strong>: score new rows or a CSV, preview impact, and download
            the frozen rule (JSON or a standalone Python scorer) plus every surviving rule.
          </li>
        </ol>

        <p className="primer-foot">
          Upload a CSV or try the sample email spam file to see PRAXIS on your (or sample) data.
        </p>
      </section>
    </>
  );
}

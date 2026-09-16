import type { Policy } from "./types";

/** Embed a frozen rule in a stdlib-only Python CSV scorer. */
export function pythonScorer(policy: Policy): string {
  const doc = JSON.stringify(policy, null, 2);
  return `#!/usr/bin/env python3
"""Standalone scorer for a PRAXIS Web rule${policy.label ? ` (${policy.label})` : ""}. Stdlib only: no server, no ML stack.

Usage:
  python score_rule.py rows.csv > scored.csv
"""
import csv
import json
import sys

POLICY = json.loads(r'''${doc}''')


def encode_row(row):
    maps = POLICY["maps"]
    out = {}
    for col in maps["columns"]:
        raw = row.get(col, "")
        kind = maps["kind"][col]
        if kind == "categorical":
            col_codes = (maps.get("codes") or {}).get(col, {})
            key = str(raw)
            if key in col_codes:
                out[col] = float(col_codes[key])
            elif "__other__" in col_codes:
                out[col] = float(col_codes["__other__"])
            else:
                out[col] = -1.0
        elif kind == "binary":
            out[col] = 1.0 if str(raw).strip().lower() in {"1", "true", "yes", "y"} else 0.0
        else:
            try:
                out[col] = float(raw)
            except (TypeError, ValueError):
                out[col] = float("nan")
    return out


def binarize(values):
    spec = POLICY["binarizer"]
    bits = {}
    if spec.get("type") == "identity":
        for col in spec.get("columns") or []:
            val = values.get(col, 0.0)
            bits[col] = 0 if val != val else int(val > 0.5)
        return bits
    for item in spec.get("thresholds") or []:
        val = values.get(item["column"], float("nan"))
        bits[item["name"]] = 0 if val != val else int(val <= float(item["threshold"]))
    return bits


def walk(tree, bits):
    paths = tree.get("paths") or []
    labels = tree.get("leaf_labels") or []
    if not paths:
        return str(labels[0]) if labels else "unknown"
    for path, label in zip(paths, labels):
        if all(bool(bits.get(s["name"], 0)) == bool(s["true"]) for s in path):
            return str(label)
    return str(labels[-1])


def score(row):
    bits = binarize(encode_row(row))
    chosen = walk(POLICY["tree"], bits)
    votes = [walk(t, bits) for t in POLICY.get("ensemble") or [POLICY["tree"]]]
    return {"prediction": chosen, "agree": sum(v == chosen for v in votes), "n": len(votes)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python score_rule.py rows.csv > scored.csv")
    with open(sys.argv[1], newline="") as fh:
        rows = list(csv.DictReader(fh))
    fields = (list(rows[0].keys()) if rows else []) + ["prediction", "rules_agree"]
    writer = csv.DictWriter(sys.stdout, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        out = score(row)
        row["prediction"] = out["prediction"]
        row["rules_agree"] = "%d/%d" % (out["agree"], out["n"])
        writer.writerow(row)
`;
}

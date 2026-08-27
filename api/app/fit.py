"""Compile a labeled table into a Rashomon set. Only module that imports PRAXIS."""

from __future__ import annotations

import json
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

REPO = Path(__file__).resolve().parents[3]
SRC = REPO / "src"
if SRC.exists() and str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from praxis import PRAXIS, ThresholdGuessBinarizer  # noqa: E402

from app.trees import base_name, profile_paths

FIT_ROWS = 1000
JACCARD_PAIRS = 200
# Cap how many matching trees we fully unpack after column constraints (best objective first).
MAX_TREES = 2000


@dataclass
class FittedBundle:
    model: Any
    bin_names: list[str]
    class_names: list[str]
    Xb_te: np.ndarray
    y_te: np.ndarray
    n_trees: int
    min_objective: int
    shell: dict
    # Column bases per tree (best-objective order). Built once for live match counts.
    bases_list: list[frozenset[str]] | None = None
    # Bit-packed bases for O(n) numpy match counts (n_trees × n_words uint64).
    bases_bits: np.ndarray | None = None
    feature_bit: dict[str, int] | None = None


def ensure_bases_index(bundle: FittedBundle) -> list[frozenset[str]]:
    """Cache frozenset + bitmasks of original-column bases for every tree."""
    if bundle.bases_list is not None and bundle.bases_bits is not None and bundle.feature_bit is not None:
        return bundle.bases_list

    if bundle.bases_list is None:
        out: list[frozenset[str]] = []
        for i in range(bundle.n_trees):
            paths, _ = bundle.model.get_tree_paths(i)
            out.append(frozenset(_bases_from_paths(paths, bundle.bin_names)))
        bundle.bases_list = out
    else:
        out = bundle.bases_list

    feature_bit: dict[str, int] = {}
    raw_bits: list[list[int]] = []
    for bases in out:
        words: list[int] = []
        for name in bases:
            bit = feature_bit.get(name)
            if bit is None:
                bit = len(feature_bit)
                feature_bit[name] = bit
            word_i = bit // 64
            while len(words) <= word_i:
                words.append(0)
            words[word_i] |= int(1 << (bit % 64))
        raw_bits.append(words)

    n_words = max((len(w) for w in raw_bits), default=1) or 1
    bits = np.zeros((len(out), n_words), dtype=np.uint64)
    for i, words in enumerate(raw_bits):
        for j, word in enumerate(words):
            bits[i, j] = np.uint64(word)

    bundle.bases_bits = bits
    bundle.feature_bit = feature_bit
    return out


def count_matching(
    bundle: FittedBundle,
    banned: list[str] | None = None,
    keep: list[str] | None = None,
) -> dict[str, int | bool]:
    """How many trees survive banned / must-use column choices (bitmask scan)."""
    from app.bases_store import count_bits

    ensure_bases_index(bundle)
    assert bundle.bases_bits is not None and bundle.feature_bit is not None
    return count_bits(bundle.bases_bits, bundle.feature_bit, banned, keep)


def encode_features(X: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    maps: dict = {"kind": {}, "codes": {}, "columns": [str(c) for c in X.columns]}
    out = pd.DataFrame(index=X.index)
    for col in X.columns:
        s = X[col]
        if pd.api.types.is_bool_dtype(s):
            out[col] = s.astype(int)
            maps["kind"][str(col)] = "binary"
        elif pd.api.types.is_numeric_dtype(s):
            vals = pd.to_numeric(s, errors="coerce")
            uniq = set(vals.dropna().unique())
            if uniq <= {0, 1, 0.0, 1.0}:
                out[col] = vals.fillna(0).astype(int)
                maps["kind"][str(col)] = "binary"
            else:
                out[col] = vals
                maps["kind"][str(col)] = "numeric"
        else:
            codes, uniques = pd.factorize(s.astype(str), sort=True)
            out[col] = codes.astype(float)
            maps["kind"][str(col)] = "categorical"
            maps["codes"][str(col)] = {str(u): int(i) for i, u in enumerate(uniques)}
    return out, maps


def already_binary(X: pd.DataFrame) -> bool:
    return all(X[c].dropna().isin([0, 1]).all() for c in X.columns)


def freeze_binarizer(tgb, columns: list[str]) -> dict:
    if tgb is None:
        return {"type": "identity", "columns": list(columns)}
    names = [str(n) for n in tgb.feature_names_in_]
    return {
        "type": "thresholds",
        "thresholds": [
            {
                "column": names[int(j)],
                "threshold": float(thresh),
                "name": f"{names[int(j)]} <= {thresh}",
            }
            for j, thresh in tgb.thresholds_
        ],
    }


def jaccard(sets: list[set[str]]) -> float:
    if len(sets) < 2:
        return 1.0
    pairs = [(i, j) for i in range(len(sets)) for j in range(i + 1, len(sets))]
    if len(pairs) > JACCARD_PAIRS:
        pairs = random.sample(pairs, JACCARD_PAIRS)
    scores = []
    for i, j in pairs:
        a, b = sets[i], sets[j]
        union = a | b
        scores.append(len(a & b) / len(union) if union else 1.0)
    return float(np.mean(scores)) if scores else 1.0


def _bases_from_paths(paths, bin_names: list[str]) -> list[str]:
    bases: set[str] = set()
    for path in paths:
        for signed in path:
            f = abs(int(signed)) - 1
            fname = bin_names[f] if 0 <= f < len(bin_names) else f"f{f}"
            bases.add(base_name(fname))
    return sorted(bases)


def _allows(bases: list[str], banned: list[str], keep: list[str]) -> bool:
    if any(name in bases for name in banned):
        return False
    if any(name not in bases for name in keep):
        return False
    return True


def _features_from_columns(columns: list[str]) -> list[dict]:
    return [{"id": c, "label": c, "frac": 0.0, "core": False} for c in columns]


def _features_from_trees(trees: list[dict]) -> list[dict]:
    n = len(trees) or 1
    base_counts: dict[str, int] = {}
    for t in trees:
        for b in t.get("bases") or []:
            base_counts[b] = base_counts.get(b, 0) + 1
    return [
        {"id": name, "label": name, "frac": count / n, "core": count == len(trees)}
        for name, count in sorted(base_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def compile_table(
    df: pd.DataFrame,
    label_col: str,
    *,
    lambda_reg: float = 0.01,
    depth_budget: int = 5,
    rashomon_mult: float = 0.05,
    lookahead_k: int = 1,
    fit_rows: int = FIT_ROWS,
    max_trees: int = MAX_TREES,
) -> tuple[dict, FittedBundle]:
    """Fit PRAXIS and return a shell result (no tree profiles yet) plus a live bundle."""
    if label_col not in df.columns:
        raise ValueError(f"Label column '{label_col}' is not in the file.")

    work = df.dropna(subset=[label_col]).copy()
    if len(work) < 20:
        raise ValueError("Need at least 20 rows with a non-empty label.")

    y_raw = work[label_col]
    classes = pd.Index(pd.unique(y_raw.astype(str)))
    if len(classes) < 2:
        raise ValueError("The label column must have at least two classes.")
    if len(classes) > 8:
        raise ValueError("This prototype handles up to 8 classes. Collapse the label first.")
    class_to_int = {c: i for i, c in enumerate(classes)}
    y = y_raw.astype(str).map(class_to_int).to_numpy(dtype=int)
    class_names = [str(c) for c in classes]

    X_raw = work.drop(columns=[label_col])
    if X_raw.shape[1] < 1:
        raise ValueError("Need at least one feature column besides the label.")

    X_num, maps = encode_features(X_raw)
    X_num = X_num.replace([np.inf, -np.inf], np.nan)
    keep_mask = X_num.notna().all(axis=1).to_numpy()
    X_num = X_num.loc[keep_mask]
    y = y[keep_mask]
    if len(y) < 20:
        raise ValueError("Too many missing feature values after cleaning.")

    strat = y if len(np.unique(y)) > 1 else None
    X_tr, X_te, y_tr, y_te = train_test_split(
        X_num, y, test_size=0.2, random_state=42, stratify=strat
    )

    if len(X_tr) > fit_rows:
        rng = np.random.RandomState(42)
        picks = []
        for cls in np.unique(y_tr):
            idx = np.where(y_tr == cls)[0]
            n = max(1, int(round(fit_rows * (len(idx) / len(y_tr)))))
            picks.append(rng.choice(idx, size=min(n, len(idx)), replace=False))
        sel = np.concatenate(picks)[:fit_rows]
        X_fit, y_fit = X_tr.iloc[sel], y_tr[sel]
    else:
        X_fit, y_fit = X_tr, y_tr

    used_tgb = not already_binary(X_fit)
    if used_tgb:
        tgb = ThresholdGuessBinarizer(
            max_depth=3, n_estimators=25, learning_rate=0.1, column_elimination=True
        )
        Xb_fit = np.asarray(tgb.fit_transform(X_fit, y_fit), dtype=np.uint8)
        Xb_te = np.asarray(tgb.transform(X_te), dtype=np.uint8)
        bin_names = [str(n) for n in tgb.get_feature_names_out()]
        binarizer = freeze_binarizer(tgb, list(X_fit.columns))
    else:
        Xb_fit = np.asarray(X_fit, dtype=np.uint8)
        Xb_te = np.asarray(X_te, dtype=np.uint8)
        bin_names = [str(c) for c in X_fit.columns]
        binarizer = freeze_binarizer(None, list(X_fit.columns))

    model = PRAXIS()
    model.fit(
        Xb_fit,
        y_fit,
        lambda_reg=lambda_reg,
        depth_budget=depth_budget,
        rashomon_mult=rashomon_mult,
        lookahead_k=lookahead_k,
    )
    n_trees = int(model.count_trees())
    if n_trees < 1:
        raise ValueError("PRAXIS found no trees. Try a cleaner label or more rows.")
    min_objective = int(model.get_min_objective())
    original_columns = [str(c) for c in X_raw.columns]

    shell = {
        "file_rows": int(len(df)),
        "fit_rows": int(len(X_fit)),
        "n_original_features": int(X_raw.shape[1]),
        "n_binary_features": int(Xb_fit.shape[1]),
        "used_tgb": used_tgb,
        "n_trees": n_trees,
        "n_profiled": 0,
        "n_matching": None,
        "min_objective": min_objective,
        "acc_min": None,
        "acc_max": None,
        "jaccard": None,
        "class_names": class_names,
        "original_columns": original_columns,
        "column_kinds": maps["kind"],
        "column_codes": maps["codes"],
        "features": _features_from_columns(original_columns),
        "trees": [],
        "label": label_col,
        "binarizer": binarizer,
        "profiled": False,
        "params": {
            "lambda_reg": float(lambda_reg),
            "depth_budget": int(depth_budget),
            "rashomon_mult": float(rashomon_mult),
            "lookahead_k": int(lookahead_k),
            "fit_rows": int(fit_rows),
            "max_trees": int(max_trees if max_trees > 0 else MAX_TREES),
        },
    }
    shell = json.loads(json.dumps(shell))
    bundle = FittedBundle(
        model=model,
        bin_names=bin_names,
        class_names=class_names,
        Xb_te=Xb_te,
        y_te=y_te,
        n_trees=n_trees,
        min_objective=min_objective,
        shell=shell,
    )
    # Index column bases so Hide-step toggles can show live x / n_trees.
    ensure_bases_index(bundle)
    column_use = {c: 0 for c in original_columns}
    for bases in bundle.bases_list or []:
        for name in bases:
            column_use[name] = column_use.get(name, 0) + 1
    shell["column_use"] = column_use
    shell["features"] = [
        {
            "id": c,
            "label": c,
            "frac": (column_use.get(c, 0) / n_trees) if n_trees else 0.0,
            "core": column_use.get(c, 0) == n_trees,
        }
        for c in original_columns
    ]
    return shell, bundle


def profile_for_constraints(
    bundle: FittedBundle,
    banned: list[str] | None = None,
    keep: list[str] | None = None,
    max_trees: int | None = None,
) -> dict:
    """Walk trees in best-objective order; fully profile up to max_trees that match columns."""
    banned = list(banned or [])
    keep = list(keep or [])
    cap = MAX_TREES if max_trees is None else (bundle.n_trees if max_trees <= 0 else max_trees)

    trees: list[dict] = []
    scanned = 0
    matching = 0
    for i in range(bundle.n_trees):
        scanned += 1
        paths, preds = bundle.model.get_tree_paths(i)
        bases = _bases_from_paths(paths, bundle.bin_names)
        if not _allows(bases, banned, keep):
            continue
        matching += 1
        obj, _ = bundle.model.get_tree_objective(i)
        profile = profile_paths(paths, preds, bundle.bin_names, bundle.class_names, i, int(obj))
        pred = np.asarray(bundle.model.get_predictions(i, bundle.Xb_te))
        profile["acc"] = float(np.mean(pred == bundle.y_te)) if len(bundle.y_te) else None
        trees.append(profile)
        if len(trees) >= cap:
            break

    if not trees:
        raise ValueError("No good rule survives these column choices.")

    accs = [t["acc"] for t in trees if t["acc"] is not None]
    out = dict(bundle.shell)
    out.update(
        {
            "n_profiled": len(trees),
            "n_matching": matching if len(trees) < cap else None,
            "n_scanned": scanned,
            "acc_min": min(accs) if accs else None,
            "acc_max": max(accs) if accs else None,
            "jaccard": jaccard([set(t["bases"]) for t in trees]),
            "features": _features_from_trees(trees),
            "trees": trees,
            "profiled": True,
            "constraints": {"banned": banned, "keep": keep},
        }
    )
    # If we stopped early at cap, matching among all trees is unknown (>= len(trees)).
    if len(trees) >= cap and scanned < bundle.n_trees:
        out["n_matching"] = None
        out["matching_note"] = (
            f"Showing the first {cap} best-objective trees that match. "
            f"Scanned {scanned} of {bundle.n_trees} before the cap."
        )
    else:
        out["n_matching"] = matching
        out["matching_note"] = None
    return json.loads(json.dumps(out))

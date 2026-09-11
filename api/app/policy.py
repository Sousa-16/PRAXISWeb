"""Freeze a selected tree and score rows from JSON. No PRAXIS import."""

from __future__ import annotations

from typing import Any

from app.constraints import remaining_trees
from app.encode import encode_row

SCHEMA_VERSION = 1
SLIM_KEYS = (
    "id",
    "paths",
    "leaf_labels",
    "rules",
    "bases",
    "splits",
    "leaves",
    "depth",
    "acc",
    "diagram",
    "objective",
)


def slim_tree(tree: dict) -> dict:
    return {key: tree[key] for key in SLIM_KEYS if key in tree}


def freeze_policy(
    job_result: dict,
    tree_id: int,
    banned: list[str] | None = None,
    keep: list[str] | None = None,
) -> dict:
    banned = list(banned or [])
    keep = list(keep or [])
    live = remaining_trees(job_result["trees"], banned, keep)
    if not live:
        raise ValueError("No good rule survives these constraints.")
    tree = next((t for t in live if int(t["id"]) == int(tree_id)), None)
    if tree is None:
        raise ValueError("Selected rule is not allowed under these constraints.")
    if "paths" not in tree or "leaf_labels" not in tree:
        raise ValueError("Job result is missing frozen paths; re-run the search.")
    return {
        "schema_version": SCHEMA_VERSION,
        "label": job_result.get("label"),
        "class_names": job_result.get("class_names") or [],
        "maps": {
            "columns": job_result["original_columns"],
            "kind": job_result["column_kinds"],
            "codes": job_result.get("column_codes") or {},
        },
        "binarizer": job_result["binarizer"],
        "tree": slim_tree(tree),
        "ensemble": [slim_tree(t) for t in live],
        "constraints": {"banned": banned, "keep": keep},
    }


def binarize(values: dict[str, float], spec: dict) -> dict[str, int]:
    if spec.get("type") == "identity":
        bits = {}
        for col in spec.get("columns") or []:
            val = values.get(col, 0.0)
            bits[col] = 0 if val != val else int(val > 0.5)
        return bits
    bits = {}
    for item in spec.get("thresholds") or []:
        name = item["name"]
        col = item["column"]
        thresh = float(item["threshold"])
        val = values.get(col, float("nan"))
        bits[name] = 0 if val != val else int(val <= thresh)
    return bits


def walk_tree_path(tree: dict, bits: dict[str, int]) -> tuple[str, list[dict]]:
    """Return (leaf label, the condition path that matched)."""
    paths = tree.get("paths") or []
    labels = tree.get("leaf_labels") or []
    if not paths:
        return (str(labels[0]) if labels else "unknown"), []
    for path, label in zip(paths, labels):
        if not path:
            return str(label), []
        matched = True
        for step in path:
            bit = bits.get(step["name"], 0)
            want = bool(step["true"])
            if bool(bit) != want:
                matched = False
                break
        if matched:
            return str(label), list(path)
    return str(labels[-1]), []


def walk_tree(tree: dict, bits: dict[str, int]) -> str:
    return walk_tree_path(tree, bits)[0]


def explain_step(step: dict) -> str:
    """Human-readable form of one satisfied path condition."""
    name = str(step["name"])
    if bool(step["true"]):
        return name
    if " <= " in name:
        col, thresh = name.split(" <= ", 1)
        return f"{col} > {thresh}"
    return f"not ({name})"


def score_policy(policy: dict, row: dict[str, Any]) -> dict:
    values = encode_row(row, policy["maps"])
    bits = binarize(values, policy["binarizer"])
    chosen, path = walk_tree_path(policy["tree"], bits)
    ensemble = policy.get("ensemble") or [policy["tree"]]
    votes = [walk_tree(tree, bits) for tree in ensemble]
    agree = sum(v == chosen for v in votes)
    tree = policy["tree"]
    return {
        "prediction": chosen,
        "agree": agree,
        "n": len(votes),
        "rules": tree.get("rules") or [],
        "reason": [explain_step(step) for step in path],
        "tree_id": tree.get("id"),
    }


def score_job(
    job_result: dict,
    row: dict[str, Any],
    tree_id: int,
    banned: list[str] | None = None,
    keep: list[str] | None = None,
) -> dict:
    policy = freeze_policy(job_result, tree_id, banned, keep)
    return score_policy(policy, row)



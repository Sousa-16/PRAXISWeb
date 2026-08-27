"""Column constraints over a Rashomon set. No PRAXIS import."""

from __future__ import annotations


def remaining_trees(
    trees: list[dict],
    banned: list[str] | None = None,
    keep: list[str] | None = None,
) -> list[dict]:
    banned = list(banned or [])
    keep = list(keep or [])
    out = []
    for tree in trees:
        bases = tree.get("bases") or []
        if any(name in bases for name in banned):
            continue
        if any(name not in bases for name in keep):
            continue
        out.append(tree)
    return out

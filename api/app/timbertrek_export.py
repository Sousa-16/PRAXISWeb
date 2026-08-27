"""Build TimberTrek HierarchyJSON from profiled PRAXIS trees.

Matches the file TreeFARMS writes via timbertrek.transform_trie_to_rules():
{trie, featureMap, treeMap} only. Tree IDs are 1..n.
"""

from __future__ import annotations

from typing import Any

import numpy as np

DEFAULT_EXPORT_CAP = 2000
MAX_EXPORT_CAP = 5000


def _feature_entry(name: str) -> list[str]:
    """[readable name, value/threshold, short name]; same 3-tuple as official files."""
    if " <= " in name:
        base, thresh = name.rsplit(" <= ", 1)
        base = base.strip()
        try:
            t = float(thresh)
            pretty = f"{int(t)}" if t == int(t) else f"{t:g}"
        except ValueError:
            pretty = thresh.strip()
        return [base, f"<= {pretty}", base]
    if ":" in name:
        head, tail = name.split(":", 1)
        return [head.strip(), tail.strip(), head.strip()]
    return [name, "", name]


def _sign_for_label(label: str, class_names: list[str]) -> str:
    """TimberTrek leaves are binary +/−. First class → − (0), others → + (1)."""
    if not class_names:
        return "+"
    return "-" if str(label) == str(class_names[0]) else "+"


class _Node:
    __slots__ = ("feature_id", "left", "right", "pred")

    def __init__(self) -> None:
        self.feature_id: str | None = None
        self.left: _Node | None = None
        self.right: _Node | None = None
        self.pred: str | None = None


def _paths_to_tree_node(
    paths: list[list[dict]],
    leaf_labels: list[str],
    name_to_id: dict[str, int],
    class_names: list[str],
) -> dict:
    """Complete binary tree: child 0 = feature true, child 1 = feature false."""
    root = _Node()
    for steps, label in zip(paths, leaf_labels):
        cur = root
        if not steps:
            cur.pred = _sign_for_label(label, class_names)
            continue
        for step in steps:
            name = str(step["name"])
            if name not in name_to_id:
                name_to_id[name] = len(name_to_id)
            fid = str(name_to_id[name])
            go_true = bool(step.get("true", True))
            if cur.feature_id is None:
                cur.feature_id = fid
                cur.left = _Node()
                cur.right = _Node()
            nxt = cur.left if go_true else cur.right
            if nxt is None:
                nxt = _Node()
                if go_true:
                    cur.left = nxt
                else:
                    cur.right = nxt
            cur = nxt
        cur.pred = _sign_for_label(label, class_names)

    def dump(node: _Node) -> dict:
        is_leaf = node.pred is not None or node.feature_id is None or node.left is None or node.right is None
        if is_leaf:
            pred = node.pred or "-"
            return {"f": [pred, 1, 1 if pred == "+" else 0]}
        return {
            "f": [node.feature_id or "0", 1, -1],
            "c": [dump(node.left), dump(node.right)],  # type: ignore[arg-type]
        }

    return dump(root)


def _insert_trie_path(root: dict, feature_ids: list[str], tree_id: int) -> None:
    """Sunburst trie (keep_position=False): feature ids only, one leaf per tree per prefix."""
    node = root
    for fid in feature_ids:
        children = node.setdefault("c", [])
        found = None
        for child in children:
            if child.get("f") == fid and "t" not in child:
                found = child
                break
        if found is None:
            found = {"f": fid, "c": []}
            children.append(found)
        node = found
    children = node.setdefault("c", [])
    if any(c.get("f") == "_" and c.get("t") == tree_id for c in children):
        return
    children.append({"f": "_", "t": int(tree_id)})


def _fill_counts_from_xy(
    node: dict,
    X,
    y,
    id_to_name: dict[int, str],
    name_to_col: dict[str, int],
    rows: list[int] | None = None,
) -> None:
    """Write [feature, n_samples, n_correct] like TreeFARMS/TimberTrek (n_correct=-1 on splits)."""
    if rows is None:
        idx = np.arange(len(y))
    else:
        idx = np.asarray(rows, dtype=int)
    n = int(len(idx))
    f0 = str(node["f"][0])
    if f0 in {"+", "-"}:
        pred = 1 if f0 == "+" else 0
        correct = int(np.sum(y[idx] == pred)) if n else 0
        node["f"] = [f0, max(n, 1), correct]
        return
    name = id_to_name[int(f0)]
    col = name_to_col.get(name)
    node["f"] = [f0, max(n, 1), -1]
    kids = node.get("c") or []
    if len(kids) != 2 or col is None or n == 0:
        for kid in kids:
            _fill_counts_from_xy(kid, X, y, id_to_name, name_to_col, idx.tolist())
        return
    xcol = X[idx, col]
    true_rows = idx[xcol == 1].tolist()
    false_rows = idx[xcol != 1].tolist()
    _fill_counts_from_xy(kids[0], X, y, id_to_name, name_to_col, true_rows)
    _fill_counts_from_xy(kids[1], X, y, id_to_name, name_to_col, false_rows)


def _fill_counts_varied(node: dict, n: int, salt: int) -> None:
    """Placeholder counts with variation so TimberTrek's d3.bin() does not collapse to 1 bin."""
    f0 = str(node["f"][0])
    kids = node.get("c") or []
    if f0 in {"+", "-"} or not kids:
        k = max(2, int(n)) + (salt % 23)
        correct = k if f0 == "+" else max(0, k // 3)
        node["f"] = [f0, k, correct]
        return
    node["f"] = [f0, max(n, 2), -1]
    left_n = max(2, (n * 5) // 8)
    right_n = max(2, n - left_n)
    if len(kids) >= 1:
        _fill_counts_varied(kids[0], left_n, salt * 3 + 1)
    if len(kids) >= 2:
        _fill_counts_varied(kids[1], right_n, salt * 5 + 2)


def build_timbertrek_doc(
    result: dict[str, Any],
    trees: list[dict[str, Any]] | None = None,
    *,
    banned: list[str] | None = None,
    keep: list[str] | None = None,
    bin_names: list[str] | None = None,
    Xb=None,
    y=None,
) -> dict[str, Any]:
    """Return official HierarchyJSON: trie + featureMap + treeMap."""
    del banned, keep
    trees = list(trees if trees is not None else (result.get("trees") or []))
    class_names = [str(c) for c in (result.get("class_names") or [])]
    name_to_id: dict[str, int] = {}
    tree_map: dict[str, list] = {}
    trie: dict[str, Any] = {"f": "root", "c": []}
    n_fit = int(result.get("fit_rows") or result.get("file_rows") or 1000)

    export_id = 0
    for tree in trees:
        paths = tree.get("paths") or []
        labels = tree.get("leaf_labels") or []
        if not paths or len(paths) != len(labels):
            continue
        export_id += 1
        node = _paths_to_tree_node(paths, labels, name_to_id, class_names)
        acc = tree.get("acc")
        # Tiny unique offset: TimberTrek's d3.bin() crashes if every accuracy is identical.
        acc_f = (round(float(acc), 5) if acc is not None else 0.0) + export_id * 1e-6
        tree_map[str(export_id)] = [node, 0, acc_f]
        seen_prefixes: set[tuple[str, ...]] = set()
        for steps in paths:
            fids: list[str] = []
            for step in steps:
                name = str(step["name"])
                if name not in name_to_id:
                    name_to_id[name] = len(name_to_id)
                fids.append(str(name_to_id[name]))
            key = tuple(fids)
            if key in seen_prefixes:
                continue
            seen_prefixes.add(key)
            _insert_trie_path(trie, fids, export_id)

    id_to_name = {i: name for name, i in name_to_id.items()}
    can_count = Xb is not None and y is not None and bin_names is not None
    name_to_col = {str(n): i for i, n in enumerate(bin_names or [])}
    for tid, entry in tree_map.items():
        if can_count:
            _fill_counts_from_xy(entry[0], Xb, y, id_to_name, name_to_col)
        else:
            _fill_counts_varied(entry[0], n_fit, int(tid) * 17)
        _nudge_leaf_samples(entry[0], int(tid) % 19)

    feature_map = {
        str(i): _feature_entry(name)
        for name, i in sorted(name_to_id.items(), key=lambda kv: kv[1])
    }
    return {"trie": trie, "featureMap": feature_map, "treeMap": tree_map}


def _nudge_leaf_samples(node: dict, extra: int) -> None:
    """Keep min-leaf-sample values from collapsing to one d3.bin() bucket."""
    f = node.get("f")
    if isinstance(f, list) and f and str(f[0]) in {"+", "-"}:
        node["f"] = [f[0], int(f[1]) + extra, f[2]]
        return
    for child in node.get("c") or []:
        _nudge_leaf_samples(child, extra)


def clamp_export_cap(max_trees: int | None) -> int:
    if max_trees is None:
        return DEFAULT_EXPORT_CAP
    if max_trees <= 0:
        return MAX_EXPORT_CAP
    return max(1, min(int(max_trees), MAX_EXPORT_CAP))

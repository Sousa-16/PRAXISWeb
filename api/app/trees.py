"""Layout a decision tree from signed PRAXIS paths. Used at compile time only."""

from __future__ import annotations


def pretty_condition(name: str) -> str:
    if " <= " not in name:
        return name
    base, thresh = name.rsplit(" <= ", 1)
    try:
        t = float(thresh)
        if t == int(t):
            pretty = f"{int(t):,}" if abs(t) >= 1000 else str(int(t))
        else:
            pretty = f"{t:g}"
        return f"{base.strip()} ≤ {pretty}"
    except ValueError:
        return name


def base_name(name: str) -> str:
    if " <= " in name:
        return name.rsplit(" <= ", 1)[0].strip()
    return name


def tree_diagram(paths, preds, names: list[str], class_names: list[str]) -> dict:
    class Node:
        __slots__ = ("feature", "name", "left", "right", "prediction")

        def __init__(self):
            self.feature = None
            self.name = None
            self.left = None
            self.right = None
            self.prediction = None

    root = Node()
    if not paths:
        return {"nodes": []}

    for path, pred in zip(paths, preds):
        label = class_names[int(pred)] if int(pred) < len(class_names) else str(pred)
        cur = root
        if not path:
            cur.prediction = label
            continue
        for signed_f in path:
            f = abs(int(signed_f)) - 1
            go_left = int(signed_f) > 0
            if cur.feature is None:
                cur.feature = f
                cur.name = names[f] if 0 <= f < len(names) else f"f{f}"
                cur.left = Node()
                cur.right = Node()
            cur = cur.left if go_left else cur.right
        cur.prediction = label

    leaves: list = []

    def collect(node):
        if node is None:
            return
        if node.prediction is not None or node.left is None:
            leaves.append(node)
            return
        collect(node.left)
        collect(node.right)

    collect(root)
    leaf_x = {leaf: i for i, leaf in enumerate(leaves)}
    pos: dict = {}

    def place(node, depth: int):
        if node.prediction is not None or node.left is None:
            pos[node] = (float(leaf_x.get(node, 0)), float(depth))
            return
        place(node.left, depth + 1)
        place(node.right, depth + 1)
        lx, _ = pos[node.left]
        rx, _ = pos[node.right]
        pos[node] = ((lx + rx) / 2.0, float(depth))

    place(root, 0)
    nodes: list[dict] = []

    def assign(node):
        i = len(nodes)
        x, y = pos[node]
        rec: dict = {"id": i, "x": x, "y": y}
        if node.prediction is not None:
            rec.update(kind="leaf", label=str(node.prediction))
        else:
            rec.update(kind="split", label=pretty_condition(node.name or ""))
        nodes.append(rec)
        if node.left is not None:
            rec["left"] = assign(node.left)
        if node.right is not None:
            rec["right"] = assign(node.right)
        return i

    assign(root)
    return {"nodes": nodes}


def profile_paths(paths, preds, names: list[str], class_names: list[str], idx: int, objective: int) -> dict:
    splits = set()
    bases = set()
    rules = []
    frozen_paths = []
    leaf_labels = []
    for path, pred in zip(paths, preds):
        parts = []
        steps = []
        for signed in path:
            f = abs(int(signed)) - 1
            fname = names[f] if f < len(names) else f"f{f}"
            splits.add(fname)
            bases.add(base_name(fname))
            true = int(signed) > 0
            steps.append({"name": fname, "true": true})
            parts.append(fname if true else f"not ({fname})")
        label = class_names[int(pred)] if int(pred) < len(class_names) else str(pred)
        clause = " AND ".join(parts) if parts else "TRUE"
        rules.append(f"IF {clause} THEN {label}")
        frozen_paths.append(steps)
        leaf_labels.append(label)
    depths = [len(p) for p in paths]
    return {
        "id": int(idx),
        "objective": int(objective),
        "leaves": int(len(paths)),
        "depth": int(max(depths) if depths else 0),
        "splits": sorted(splits),
        "bases": sorted(bases),
        "rules": rules,
        "paths": frozen_paths,
        "leaf_labels": leaf_labels,
        "diagram": tree_diagram(paths, preds, names, class_names),
    }

import type { RuleSort, TreeProfile } from "./types";

export function remainingTrees(trees: TreeProfile[], banned: string[], keep: string[]): TreeProfile[] {
  return trees.filter((tree) => {
    const bases = tree.bases || [];
    if (banned.some((name) => bases.includes(name))) return false;
    if (keep.some((name) => !bases.includes(name))) return false;
    return true;
  });
}

export function bestAccuracy(trees: TreeProfile[]): number | null {
  const accs = trees.map((t) => t.acc).filter((a): a is number => a != null);
  return accs.length ? Math.max(...accs) : null;
}

export function sortTrees(trees: TreeProfile[], sort: RuleSort): TreeProfile[] {
  const copy = [...trees];
  const acc = (t: TreeProfile) => (t.acc != null ? t.acc : -1);
  const leaves = (t: TreeProfile) => t.leaves ?? 0;
  const depth = (t: TreeProfile) => t.depth ?? 0;
  switch (sort) {
    case "acc_desc":
      return copy.sort((a, b) => acc(b) - acc(a) || a.id - b.id);
    case "acc_asc":
      return copy.sort((a, b) => acc(a) - acc(b) || a.id - b.id);
    case "leaves_desc":
      return copy.sort((a, b) => leaves(b) - leaves(a) || a.id - b.id);
    case "leaves_asc":
      return copy.sort((a, b) => leaves(a) - leaves(b) || a.id - b.id);
    case "depth_desc":
      return copy.sort((a, b) => depth(b) - depth(a) || a.id - b.id);
    case "depth_asc":
      return copy.sort((a, b) => depth(a) - depth(b) || a.id - b.id);
    default:
      return copy;
  }
}

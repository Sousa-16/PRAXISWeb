import { remainingTrees, bestAccuracy, sortTrees } from "./trees";
import type { TreeProfile } from "./types";

function tree(partial: Partial<TreeProfile> & { id: number }): TreeProfile {
  return {
    bases: [],
    rules: [],
    ...partial,
  };
}

describe("remainingTrees", () => {
  const trees = [
    tree({ id: 1, bases: ["income"], acc: 0.9 }),
    tree({ id: 2, bases: ["income", "region"], acc: 0.8 }),
    tree({ id: 3, bases: ["region"], acc: 0.7 }),
  ];

  it("drops banned bases", () => {
    expect(remainingTrees(trees, ["income"], []).map((t) => t.id)).toEqual([3]);
  });

  it("requires keep bases", () => {
    expect(remainingTrees(trees, [], ["income"]).map((t) => t.id)).toEqual([1, 2]);
  });
});

describe("bestAccuracy / sortTrees", () => {
  const trees = [
    tree({ id: 1, bases: [], acc: 0.5, leaves: 2, depth: 1 }),
    tree({ id: 2, bases: [], acc: 0.9, leaves: 4, depth: 3 }),
  ];

  it("returns max accuracy", () => {
    expect(bestAccuracy(trees)).toBe(0.9);
  });

  it("sorts by accuracy desc", () => {
    expect(sortTrees(trees, "acc_desc").map((t) => t.id)).toEqual([2, 1]);
  });
});

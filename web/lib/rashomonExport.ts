import { downloadText } from "@/lib/download";
import type { JobResult, TreeProfile } from "@/lib/types";

type RashomonTrieDoc = {
  kind: "praxis_web.rashomon_trie";
  schema_version: 1;
  label: string;
  class_names: string[];
  constraints: { banned: string[]; keep: string[] };
  n_trees_searched: number;
  n_trees_profiled: number;
  n_acceptable: number;
  trees: TreeProfile[];
};

/** JSON of every tree that survives the current won’t-have / must-use constraints. */
function buildRashomonTrie(
  result: JobResult,
  trees: TreeProfile[],
  banned: string[],
  keep: string[],
): RashomonTrieDoc {
  return {
    kind: "praxis_web.rashomon_trie",
    schema_version: 1,
    label: result.label,
    class_names: result.class_names,
    constraints: { banned: [...banned], keep: [...keep] },
    n_trees_searched: result.n_trees,
    n_trees_profiled: result.n_profiled,
    n_acceptable: trees.length,
    trees,
  };
}

export function rashomonTrieText(
  result: JobResult,
  trees: TreeProfile[],
  banned: string[],
  keep: string[],
): string {
  return JSON.stringify(buildRashomonTrie(result, trees, banned, keep), null, 2);
}

export function downloadRashomonTrie(
  filename: string,
  result: JobResult,
  trees: TreeProfile[],
  banned: string[],
  keep: string[],
) {
  downloadText(filename, rashomonTrieText(result, trees, banned, keep), "application/json");
}

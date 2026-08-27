/** Shared workshop constants. */
export const PAGE_SIZE = 20;
export const STORE_KEY = "praxis-web-workshop";
/** Dispatched when the brand link asks to show the start page again. */
export const START_EVENT = "praxis-web:start";

export const STEPS = [
  { title: "Load a Table", detail: "CSV or sample" },
  { title: "Set Tree Rules", detail: "Won’t have / must" },
  { title: "Browse Trees", detail: "Optional: try a row" },
  { title: "Read & Save", detail: "Keep the rule" },
] as const;

export const COMPILE_MSGS = [
  "Preparing your columns…",
  "Searching for good rules…",
  "Checking accuracy on unseen rows…",
  "Comparing how similar the rules are…",
] as const;

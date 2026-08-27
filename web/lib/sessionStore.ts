import type { DatasetPreview } from "./types";
import { START_EVENT, STORE_KEY } from "./constants";

export type WorkshopStore = {
  dataset?: DatasetPreview;
  label?: string;
  jobId?: string;
  banned?: string[];
  keep?: string[];
  treeId?: number;
  step?: number;
};

export function loadWorkshopStore(): WorkshopStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(STORE_KEY) || "{}") as WorkshopStore;
  } catch {
    return {};
  }
}

export function saveWorkshopStore(next: WorkshopStore) {
  window.sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
}

export function clearWorkshopStore() {
  window.sessionStorage.removeItem(STORE_KEY);
}

/** Clear the workshop session and tell the home page to show the Hero again. */
export function requestStartPage() {
  clearWorkshopStore();
  window.dispatchEvent(new Event(START_EVENT));
}

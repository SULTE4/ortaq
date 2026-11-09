import { flushSync } from "react-dom";
import { create } from "zustand";
import { activePalette } from "./palette";
import type { Snapshot } from "./types";

interface ViewState {
  snapshot: Snapshot | null;
  mapBuilding: import("./buildingModel").ManagedBuilding | null;
  city: boolean;
  selected: string | null;
  focus: number | null;
  cameraReset: number;
  month: string;
  winter: boolean;
  night: boolean;
  balances: boolean;
  money: boolean;
  connected: boolean;
  cinematic: boolean;
  time: number;
  playing: boolean;
  speed: number;
  set: (v: Partial<ViewState>) => void;
}

export const useView = create<ViewState>()((set) => ({
  snapshot: null,
  city: false,
  mapBuilding: null,
  selected: null,
  focus: null,
  cameraReset: 0,
  month: "",
  winter: activePalette.defaultWinter,
  night: activePalette.defaultNight,
  balances: false,
  money: false,
  connected: false,
  cinematic: false,
  time: 0,
  playing: false,
  speed: 1,
  set: (v) => {
    const state = useView.getState();
    const next = {
      ...v,
      ...(v.focus != null || v.selected || v.money || v.cinematic
        ? { city: false }
        : {}),
    };
    const switchView = (["city", "money", "cinematic"] as const).some(
      (key) => next[key] !== undefined && next[key] !== state[key],
    );
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => {
        finished: Promise<void>;
      };
    };
    if (
      switchView &&
      doc.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      doc.startViewTransition(() => flushSync(() => set(next))).finished.catch(
        () => {},
      );
    } else set(next);
  },
}));

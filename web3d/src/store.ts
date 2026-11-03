import { create } from "zustand";
import type { Snapshot } from "./types";
interface ViewState {
  snapshot: Snapshot | null;
  selected: string | null;
  month: string;
  winter: boolean;
  night: boolean;
  quality: boolean;
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
  selected: null,
  month: "",
  winter: true,
  night: false,
  quality: !new URLSearchParams(location.search).has("embed"),
  balances: false,
  money: new URLSearchParams(location.search).get("embed") !== "resident",
  connected: false,
  cinematic: false,
  time: 0,
  playing: false,
  speed: 1,
  set: (v) => set(v),
}));

import { create } from "zustand";
import type { Snapshot } from "./types";
interface ViewState {
  snapshot: Snapshot | null;
  selected: string | null;
  focus: number | null;
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
  focus: null,
  month: "",
  winter: true,
  night: true,
  quality: !new URLSearchParams(location.search).has("embed"),
  balances: false,
  money: false,
  connected: false,
  cinematic: false,
  time: 0,
  playing: false,
  speed: 1,
  set: (v) => set(v),
}));

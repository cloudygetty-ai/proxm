import { create } from "zustand";
import type { UserPublic, UserProfile, PingMutual, MashTrigger, HeatZone } from "@proxm/types";

interface AppState {
  // Auth
  userId: string | null;
  accessToken: string | null;
  profile: UserProfile | null;
  setAuth: (userId: string, token: string, profile: UserProfile) => void;
  clearAuth: () => void;

  // Map
  myLat: number | null;
  myLng: number | null;
  nearbyUsers: UserPublic[];
  heatZones: HeatZone[];
  selectedUser: UserPublic | null;
  showVector: boolean;
  setLocation: (lat: number, lng: number) => void;
  setNearbyUsers: (users: UserPublic[]) => void;
  setHeatZones: (zones: HeatZone[]) => void;
  selectUser: (user: UserPublic | null) => void;
  toggleVector: () => void;

  // Status
  readyNow: boolean;
  ghostMode: boolean;
  setReadyNow: (v: boolean) => void;
  activateGhost: () => void;
  deactivateGhost: () => void;

  // Ping
  incomingPing: { pingId: string; fromUser: UserPublic } | null;
  activeChannel: PingMutual | null;
  setIncomingPing: (p: AppState["incomingPing"]) => void;
  setActiveChannel: (c: PingMutual | null) => void;
  clearPing: () => void;

  // MASH
  mashTriggers: MashTrigger[];
  setMashTriggers: (triggers: MashTrigger[]) => void;

  // Filter
  filter: "all" | "ready" | "verified";
  setFilter: (f: AppState["filter"]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  userId: null, accessToken: null, profile: null,
  setAuth: (userId, accessToken, profile) => set({ userId, accessToken, profile }),
  clearAuth: () => set({ userId: null, accessToken: null, profile: null }),

  // Map
  myLat: null, myLng: null,
  nearbyUsers: [], heatZones: [],
  selectedUser: null, showVector: false,
  setLocation: (myLat, myLng) => set({ myLat, myLng }),
  setNearbyUsers: (nearbyUsers) => set({ nearbyUsers }),
  setHeatZones: (heatZones) => set({ heatZones }),
  selectUser: (selectedUser) => set({ selectedUser, showVector: false }),
  toggleVector: () => set((s) => ({ showVector: !s.showVector })),

  // Status
  readyNow: false, ghostMode: false,
  setReadyNow: (readyNow) => set({ readyNow }),
  activateGhost: () => set({ ghostMode: true, readyNow: false }),
  deactivateGhost: () => set({ ghostMode: false }),

  // Ping
  incomingPing: null, activeChannel: null,
  setIncomingPing: (incomingPing) => set({ incomingPing }),
  setActiveChannel: (activeChannel) => set({ activeChannel }),
  clearPing: () => set({ incomingPing: null, activeChannel: null }),

  // MASH
  mashTriggers: [],
  setMashTriggers: (mashTriggers) => set({ mashTriggers }),

  // Filter
  filter: "all",
  setFilter: (filter) => set({ filter }),
}));

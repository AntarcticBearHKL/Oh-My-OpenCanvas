import { create } from "zustand";

const NAMES_VISIBLE_KEY = "canvas-show-node-names";

function initialNamesVisible() {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(NAMES_VISIBLE_KEY) === "1";
}

type NodeTitleStore = {
    namesVisible: boolean;
    toggleNamesVisible: () => void;
};

export const useNodeTitleStore = create<NodeTitleStore>((set, get) => ({
    namesVisible: initialNamesVisible(),
    toggleNamesVisible: () => {
        const next = !get().namesVisible;
        if (typeof window !== "undefined") localStorage.setItem(NAMES_VISIBLE_KEY, next ? "1" : "0");
        set({ namesVisible: next });
    },
}));

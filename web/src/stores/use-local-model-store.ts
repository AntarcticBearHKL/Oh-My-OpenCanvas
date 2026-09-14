import { create } from "zustand";

import { removeImageBackground } from "@/services/background-removal";

const BACKGROUND_REMOVAL_READY_KEY = "canvas-bg-removal-ready";

type LocalModelStatus = "idle" | "downloading" | "ready" | "error";

type LocalModelStore = {
    backgroundRemoval: { status: LocalModelStatus; percent: number };
    prepareBackgroundRemoval: (force?: boolean) => Promise<boolean>;
};

let preparing: Promise<boolean> | null = null;

function initialBackgroundRemoval() {
    if (typeof window === "undefined" || localStorage.getItem(BACKGROUND_REMOVAL_READY_KEY) !== "1") return { status: "idle" as const, percent: 0 };
    return { status: "ready" as const, percent: 100 };
}

async function warmUpBackgroundRemoval(onProgress: (percent: number) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#111111";
    context.beginPath();
    context.arc(32, 32, 18, 0, Math.PI * 2);
    context.fill();
    await removeImageBackground(canvas.toDataURL(), (_key, current, total) => {
        if (total > 0) onProgress(Math.round((current / total) * 100));
    });
}

export const useLocalModelStore = create<LocalModelStore>((set, get) => ({
    backgroundRemoval: initialBackgroundRemoval(),
    prepareBackgroundRemoval: (force?: boolean) => {
        if (!force && get().backgroundRemoval.status === "ready") return Promise.resolve(true);
        if (preparing) return preparing;
        let percent = 0;
        set({ backgroundRemoval: { status: "downloading", percent } });
        preparing = warmUpBackgroundRemoval((next) => {
            percent = Math.max(percent, next);
            set({ backgroundRemoval: { status: "downloading", percent } });
        })
            .then(() => {
                localStorage.setItem(BACKGROUND_REMOVAL_READY_KEY, "1");
                set({ backgroundRemoval: { status: "ready", percent: 100 } });
                return true;
            })
            .catch(() => {
                set({ backgroundRemoval: { status: "error", percent } });
                return false;
            })
            .finally(() => {
                preparing = null;
            });
        return preparing;
    },
}));

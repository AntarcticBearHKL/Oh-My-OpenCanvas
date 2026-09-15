import { create } from "zustand";

import { clearDirectoryHandle, loadDirectoryHandle, saveDirectoryHandle } from "@/lib/workspace/directory-handle";

export const OUTPUT_FOLDER_HANDLE_KEY = "output-folder";

export type OutputFolderStatus = "idle" | "unbound" | "unsupported" | "writing" | "error";

type OutputFolderStore = {
    folderName: string;
    supported: boolean;
    status: OutputFolderStatus;
    lastWritten: { name: string; at: number } | null;
    bindFolder: () => Promise<boolean>;
    restore: () => Promise<void>;
    clear: () => Promise<void>;
    writeOutput: (fileName: string, blob: Blob) => Promise<boolean>;
};

let directoryHandle: FileSystemDirectoryHandle | null = null;

function supportsDirectoryPicker() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

async function ensureWritePermission(handle: FileSystemDirectoryHandle) {
    if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
    try {
        return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
    } catch {
        return false;
    }
}

export const useOutputFolderStore = create<OutputFolderStore>()((set) => ({
    folderName: "",
    supported: supportsDirectoryPicker(),
    status: supportsDirectoryPicker() ? "unbound" : "unsupported",
    lastWritten: null,
    bindFolder: async () => {
        if (!supportsDirectoryPicker()) {
            set({ status: "unsupported" });
            return false;
        }
        try {
            const handle = await window.showDirectoryPicker?.({ mode: "readwrite" });
            if (!handle) return false;
            directoryHandle = handle;
            await saveDirectoryHandle(handle, OUTPUT_FOLDER_HANDLE_KEY);
            set({ folderName: handle.name, status: "idle" });
            return true;
        } catch {
            set({ status: "error" });
            return false;
        }
    },
    restore: async () => {
        if (!supportsDirectoryPicker() || directoryHandle) return;
        try {
            const handle = await loadDirectoryHandle(OUTPUT_FOLDER_HANDLE_KEY);
            if (!handle) return;
            directoryHandle = handle;
            set({ folderName: handle.name, status: "idle" });
        } catch {
            set({ status: "error" });
        }
    },
    clear: async () => {
        directoryHandle = null;
        try {
            await clearDirectoryHandle(OUTPUT_FOLDER_HANDLE_KEY);
        } catch {
            set({ status: "error" });
            return;
        }
        set({ folderName: "", status: supportsDirectoryPicker() ? "unbound" : "unsupported", lastWritten: null });
    },
    writeOutput: async (fileName, blob) => {
        const handle = directoryHandle;
        if (!handle) {
            set({ status: "unbound" });
            return false;
        }
        set({ status: "writing" });
        try {
            if (!(await ensureWritePermission(handle))) {
                set({ status: "error" });
                return false;
            }
            const fileHandle = await handle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            set({ status: "idle", lastWritten: { name: fileName, at: Date.now() } });
            return true;
        } catch {
            set({ status: "error" });
            return false;
        }
    },
}));

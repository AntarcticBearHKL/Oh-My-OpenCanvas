import { create } from "zustand";

import { ASSET_FOLDER_FILE_LIMIT, classifyAssetFolderFile, type AssetFolderFileKind } from "@/lib/canvas/asset-folder";
import { clearDirectoryHandle, loadDirectoryHandle, saveDirectoryHandle } from "@/lib/workspace/directory-handle";

export const ASSET_FOLDER_HANDLE_KEY = "asset-folder";

export type AssetFolderFile = {
    id: string;
    name: string;
    kind: AssetFolderFileKind;
    file: File;
    url: string;
};

type AssetFolderStore = {
    folderName: string;
    files: AssetFolderFile[];
    capped: boolean;
    failed: boolean;
    supported: boolean;
    bindFolder: () => Promise<boolean>;
    refresh: () => Promise<void>;
    restore: () => Promise<void>;
    clear: () => Promise<void>;
};

let directoryHandle: FileSystemDirectoryHandle | null = null;
let objectUrls: string[] = [];

function supportsDirectoryPicker() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function revokeUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
}

async function scanFolder(handle: FileSystemDirectoryHandle) {
    const files: AssetFolderFile[] = [];
    let capped = false;
    for await (const entry of handle.values()) {
        if (entry.kind !== "file") continue;
        const file = await (entry as FileSystemFileHandle).getFile();
        const kind = classifyAssetFolderFile(file);
        if (!kind) continue;
        if (files.length >= ASSET_FOLDER_FILE_LIMIT) {
            capped = true;
            break;
        }
        files.push({ id: `${files.length}-${file.name}`, name: file.name, kind, file, url: URL.createObjectURL(file) });
    }
    return { files, capped };
}

async function ensureReadPermission(handle: FileSystemDirectoryHandle) {
    if ((await handle.queryPermission({ mode: "read" })) === "granted") return true;
    try {
        return (await handle.requestPermission({ mode: "read" })) === "granted";
    } catch {
        return false;
    }
}

export const useAssetFolderStore = create<AssetFolderStore>()((set, get) => ({
    folderName: "",
    files: [],
    capped: false,
    failed: false,
    supported: supportsDirectoryPicker(),
    bindFolder: async () => {
        if (!supportsDirectoryPicker()) return false;
        try {
            const handle = await window.showDirectoryPicker?.({ mode: "read" });
            if (!handle) return false;
            directoryHandle = handle;
            await saveDirectoryHandle(handle, ASSET_FOLDER_HANDLE_KEY);
            set({ folderName: handle.name });
            await get().refresh();
            return true;
        } catch {
            return false;
        }
    },
    refresh: async () => {
        const handle = directoryHandle;
        if (!handle) return;
        try {
            const next = await scanFolder(handle);
            revokeUrls();
            objectUrls = next.files.map((item) => item.url);
            set({ folderName: handle.name, files: next.files, capped: next.capped, failed: false });
        } catch {
            set({ failed: true });
        }
    },
    restore: async () => {
        if (!supportsDirectoryPicker() || directoryHandle) return;
        try {
            const handle = await loadDirectoryHandle(ASSET_FOLDER_HANDLE_KEY);
            if (!handle) return;
            directoryHandle = handle;
            set({ folderName: handle.name });
            if (await ensureReadPermission(handle)) await get().refresh();
            else set({ failed: true });
        } catch {
            set({ failed: true });
        }
    },
    clear: async () => {
        directoryHandle = null;
        revokeUrls();
        await clearDirectoryHandle(ASSET_FOLDER_HANDLE_KEY);
        set({ folderName: "", files: [], capped: false, failed: false });
    },
}));

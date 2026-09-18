import { create } from "zustand";

import { ASSET_FOLDER_FILE_LIMIT, classifyAssetFolderFile, type AssetFolderFileKind } from "@/lib/canvas/asset-folder";
import { clearDirectoryHandle, loadDirectoryHandle, saveDirectoryHandle } from "@/lib/workspace/directory-handle";

export type AssetFolderFile = {
    id: string;
    name: string;
    kind: AssetFolderFileKind;
    file: File;
};

export type AssetCollectStatus = "idle" | "saving" | "saved" | "failed";

export type AssetFolderBinding = {
    folderName: string;
    files: AssetFolderFile[];
    capped: boolean;
    failed: boolean;
    collectStatus: AssetCollectStatus;
};

type AssetFolderStore = {
    supported: boolean;
    folders: Record<string, AssetFolderBinding>;
    bindFolder: (nodeId: string) => Promise<boolean>;
    refresh: (nodeId: string) => Promise<void>;
    restore: (nodeId: string) => Promise<void>;
    clear: (nodeId: string) => Promise<void>;
    requestWriteAccess: (nodeId: string) => Promise<boolean>;
    writeAsset: (nodeId: string, fileName: string, blob: Blob) => Promise<boolean>;
    setCollectStatus: (nodeId: string, collectStatus: AssetCollectStatus) => void;
};

const EMPTY_BINDING: AssetFolderBinding = { folderName: "", files: [], capped: false, failed: false, collectStatus: "idle" };
const directoryHandles = new Map<string, FileSystemDirectoryHandle>();

function handleKey(nodeId: string) {
    return `asset-folder:${nodeId}`;
}

function supportsDirectoryPicker() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
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
        files.push({ id: `${files.length}-${file.name}`, name: file.name, kind, file });
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

async function ensureWritePermission(handle: FileSystemDirectoryHandle) {
    if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
    try {
        return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
    } catch {
        return false;
    }
}

export const useAssetFolderStore = create<AssetFolderStore>()((set, get) => {
    const patch = (nodeId: string, value: Partial<AssetFolderBinding>) =>
        set((state) => ({ folders: { ...state.folders, [nodeId]: { ...(state.folders[nodeId] ?? EMPTY_BINDING), ...value } } }));

    return {
        supported: supportsDirectoryPicker(),
        folders: {},
        bindFolder: async (nodeId) => {
            if (!supportsDirectoryPicker()) return false;
            try {
                const handle = await window.showDirectoryPicker?.({ mode: "readwrite" });
                if (!handle) return false;
                directoryHandles.set(nodeId, handle);
                await saveDirectoryHandle(handle, handleKey(nodeId));
                patch(nodeId, { folderName: handle.name, files: [], capped: false, failed: false });
                await get().refresh(nodeId);
                return true;
            } catch {
                return false;
            }
        },
        refresh: async (nodeId) => {
            const handle = directoryHandles.get(nodeId);
            if (!handle) return;
            try {
                const next = await scanFolder(handle);
                patch(nodeId, { folderName: handle.name, files: next.files, capped: next.capped, failed: false });
            } catch {
                patch(nodeId, { failed: true });
            }
        },
        restore: async (nodeId) => {
            if (!supportsDirectoryPicker() || directoryHandles.has(nodeId)) return;
            try {
                const handle = await loadDirectoryHandle(handleKey(nodeId));
                if (!handle) return;
                directoryHandles.set(nodeId, handle);
                patch(nodeId, { folderName: handle.name });
                if (await ensureReadPermission(handle)) await get().refresh(nodeId);
                else patch(nodeId, { failed: true });
            } catch {
                patch(nodeId, { failed: true });
            }
        },
        clear: async (nodeId) => {
            directoryHandles.delete(nodeId);
            await clearDirectoryHandle(handleKey(nodeId));
            set((state) => {
                const folders = { ...state.folders };
                delete folders[nodeId];
                return { folders };
            });
        },
        requestWriteAccess: async (nodeId) => {
            const handle = directoryHandles.get(nodeId);
            return handle ? ensureWritePermission(handle) : false;
        },
        writeAsset: async (nodeId, fileName, blob) => {
            const handle = directoryHandles.get(nodeId);
            if (!handle) {
                patch(nodeId, { collectStatus: "failed" });
                return false;
            }
            patch(nodeId, { collectStatus: "saving" });
            try {
                if (!(await ensureWritePermission(handle))) {
                    patch(nodeId, { collectStatus: "failed" });
                    return false;
                }
                const fileHandle = await handle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                patch(nodeId, { collectStatus: "saved" });
                await get().refresh(nodeId);
                return true;
            } catch {
                patch(nodeId, { collectStatus: "failed" });
                return false;
            }
        },
        setCollectStatus: (nodeId, collectStatus) => patch(nodeId, { collectStatus }),
    };
});

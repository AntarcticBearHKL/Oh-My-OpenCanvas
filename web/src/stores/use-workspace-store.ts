import { create } from "zustand";
import { persist } from "zustand/middleware";

import { clearDirectoryHandle, loadDirectoryHandle, saveDirectoryHandle } from "@/lib/workspace/directory-handle";
import { conflictFileName, planWorkspaceSync, workspaceFileName, type WorkspaceSyncAction } from "@/lib/workspace/workspace-sync";
import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";

export type WorkspaceSyncSummary = { uploaded: number; downloaded: number; conflicts: number };
export type WorkspaceSyncChoice = "local" | "remote";

type WorkspaceStore = {
    directoryName: string;
    supported: boolean;
    lastSyncedAt: Record<string, number>;
    status: string;
    lastSummary: WorkspaceSyncSummary | null;
    pendingConflicts: WorkspaceSyncAction[];
    bindDirectory: () => Promise<boolean>;
    unbind: () => Promise<void>;
    restore: () => Promise<void>;
    syncNow: (projects: CanvasProject[]) => Promise<WorkspaceSyncSummary>;
    resolveConflict: (projectId: string, choice: WorkspaceSyncChoice) => Promise<void>;
};

const WORKSPACE_STORE_KEY = "infinite-canvas:workspace_store";
let directoryHandle: FileSystemDirectoryHandle | null = null;
let syncing = false;

function supportsDirectoryPicker() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

async function ensurePermission(handle: FileSystemDirectoryHandle, request: boolean) {
    if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
    if (!request) return false;
    try {
        return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
    } catch {
        return false;
    }
}

async function writeWorkspaceFile(handle: FileSystemDirectoryHandle, name: string, text: string) {
    const fileHandle = await handle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
}

async function readWorkspaceFile(handle: FileSystemDirectoryHandle, name: string) {
    const fileHandle = await handle.getFileHandle(name);
    return fileHandle.getFile();
}

async function listWorkspaceFiles(handle: FileSystemDirectoryHandle) {
    const files: { name: string; mtime: number }[] = [];
    for await (const entry of handle.values()) {
        if (entry.kind !== "file" || !entry.name.endsWith(".json")) continue;
        const file = await (entry as FileSystemFileHandle).getFile();
        files.push({ name: file.name, mtime: file.lastModified });
    }
    return files;
}

function projectMtime(project: CanvasProject) {
    const value = Date.parse(project.updatedAt);
    return Number.isNaN(value) ? undefined : value;
}

function parseProject(text: string): CanvasProject | null {
    try {
        const parsed = JSON.parse(text) as Partial<CanvasProject> | null;
        if (!parsed || typeof parsed.id !== "string" || !Array.isArray(parsed.nodes)) return null;
        return parsed as CanvasProject;
    } catch {
        return null;
    }
}

export const useWorkspaceStore = create<WorkspaceStore>()(
    persist(
        (set, get) => ({
            directoryName: "",
            supported: supportsDirectoryPicker(),
            lastSyncedAt: {},
            status: supportsDirectoryPicker() ? "unbound" : "unsupported",
            lastSummary: null,
            pendingConflicts: [],
            bindDirectory: async () => {
                if (!supportsDirectoryPicker()) {
                    set({ status: "unsupported" });
                    return false;
                }
                try {
                    const handle = await window.showDirectoryPicker?.({ mode: "readwrite" });
                    if (!handle) return false;
                    directoryHandle = handle;
                    await saveDirectoryHandle(handle);
                    set({ directoryName: handle.name, status: "idle" });
                    return true;
                } catch {
                    set({ status: "error" });
                    return false;
                }
            },
            unbind: async () => {
                directoryHandle = null;
                await clearDirectoryHandle();
                set({ directoryName: "", lastSyncedAt: {}, pendingConflicts: [], lastSummary: null, status: supportsDirectoryPicker() ? "unbound" : "unsupported" });
            },
            restore: async () => {
                if (!supportsDirectoryPicker()) {
                    set({ status: "unsupported" });
                    return;
                }
                try {
                    const handle = await loadDirectoryHandle();
                    if (!handle) return;
                    directoryHandle = handle;
                    await ensurePermission(handle, true);
                    set({ directoryName: handle.name, status: "idle" });
                } catch {
                    set({ status: "error" });
                }
            },
            syncNow: async (projects) => {
                const summary: WorkspaceSyncSummary = { uploaded: 0, downloaded: 0, conflicts: 0 };
                if (!supportsDirectoryPicker()) {
                    set({ status: "unsupported" });
                    return summary;
                }
                if (syncing) return summary;
                if (!directoryHandle) await get().restore();
                const handle = directoryHandle;
                if (!handle) {
                    set({ status: "unbound" });
                    return summary;
                }
                if (!(await ensurePermission(handle, true))) {
                    set({ status: "permissionDenied" });
                    return summary;
                }
                syncing = true;
                set({ status: "syncing", pendingConflicts: [] });
                try {
                    const files = await listWorkspaceFiles(handle);
                    const actions = planWorkspaceSync({
                        projects: projects.map((project) => ({ id: project.id, title: project.title, updatedAt: projectMtime(project) })),
                        files,
                        lastSyncedAt: get().lastSyncedAt,
                    });
                    const conflicts: WorkspaceSyncAction[] = [];
                    const nextSyncedAt = { ...get().lastSyncedAt };
                    const canvasState = useCanvasStore.getState();
                    let canvasProjects = canvasState.projects;
                    for (const action of actions) {
                        if (action.action === "upload") {
                            const project = projects.find((item) => item.id === action.projectId);
                            if (!project) continue;
                            await writeWorkspaceFile(handle, action.fileName, JSON.stringify(project));
                            nextSyncedAt[project.id] = Date.now();
                            summary.uploaded += 1;
                        } else if (action.action === "download") {
                            const parsed = parseProject(await (await readWorkspaceFile(handle, action.fileName)).text());
                            if (!parsed) continue;
                            canvasProjects = canvasProjects.some((item) => item.id === parsed.id) ? canvasProjects.map((item) => (item.id === parsed.id ? parsed : item)) : [parsed, ...canvasProjects];
                            nextSyncedAt[parsed.id] = Date.now();
                            summary.downloaded += 1;
                        } else if (action.action === "conflict") {
                            conflicts.push(action);
                            summary.conflicts += 1;
                        }
                    }
                    if (summary.downloaded) useCanvasStore.getState().replaceProjects(canvasProjects, canvasState.deletedProjects);
                    set({ lastSyncedAt: nextSyncedAt, pendingConflicts: conflicts, lastSummary: summary, status: "synced" });
                    return summary;
                } catch {
                    set({ status: "error" });
                    return summary;
                } finally {
                    syncing = false;
                }
            },
            resolveConflict: async (projectId, choice) => {
                const handle = directoryHandle;
                if (!handle || !(await ensurePermission(handle, true))) {
                    set({ status: "permissionDenied" });
                    return;
                }
                const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
                if (!project) return;
                try {
                    const fileName = workspaceFileName(project.id, project.title);
                    const existing = (await listWorkspaceFiles(handle)).map((file) => file.name);
                    const remoteText = existing.includes(fileName) ? await (await readWorkspaceFile(handle, fileName)).text() : null;
                    if (choice === "local") {
                        if (remoteText !== null) await writeWorkspaceFile(handle, conflictFileName(fileName, existing), remoteText);
                        await writeWorkspaceFile(handle, fileName, JSON.stringify(project));
                    } else {
                        await writeWorkspaceFile(handle, conflictFileName(fileName, existing), JSON.stringify(project));
                        const parsed = remoteText === null ? null : parseProject(remoteText);
                        if (parsed) {
                            const canvasState = useCanvasStore.getState();
                            canvasState.replaceProjects(canvasState.projects.map((item) => (item.id === parsed.id ? parsed : item)), canvasState.deletedProjects);
                        }
                    }
                    set((state) => ({ lastSyncedAt: { ...state.lastSyncedAt, [projectId]: Date.now() }, pendingConflicts: state.pendingConflicts.filter((item) => item.projectId !== projectId) }));
                } catch {
                    set({ status: "error" });
                }
            },
        }),
        {
            name: WORKSPACE_STORE_KEY,
            partialize: (state) => ({ directoryName: state.directoryName, lastSyncedAt: state.lastSyncedAt }),
        },
    ),
);

export type WorkspaceSyncAction = {
    projectId: string;
    fileName: string;
    action: "upload" | "download" | "conflict" | "noop";
};

export type WorkspaceSyncProject = {
    id: string;
    title: string;
    updatedAt?: number;
};

export type WorkspaceSyncFile = {
    name: string;
    mtime: number;
};

export type WorkspaceSyncActionInput = {
    localMtime?: number;
    remoteMtime?: number;
    lastSyncedAt?: number;
};

export type WorkspaceSyncPlanInput = {
    projects: WorkspaceSyncProject[];
    files: WorkspaceSyncFile[];
    lastSyncedAt: Record<string, number>;
};

const ILLEGAL_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;
const MAX_FILE_BASE = 48;

function safeBase(value: string) {
    return value
        .replace(ILLEGAL_FILE_CHARS, "")
        .replace(/\s+/g, " ")
        .replace(/^[.\s]+|[.\s]+$/g, "")
        .slice(0, MAX_FILE_BASE);
}

export function workspaceFileName(id: string, title: string): string {
    const base = safeBase(title) || safeBase(id) || "untitled";
    return `${base}.json`;
}

export function conflictFileName(fileName: string, existing: string[] = []): string {
    const dot = fileName.lastIndexOf(".");
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    const extension = dot > 0 ? fileName.slice(dot) : "";
    const taken = new Set(existing);
    const first = `${base}_conflict${extension}`;
    if (!taken.has(first)) return first;
    let index = 2;
    while (taken.has(`${base}_conflict-${index}${extension}`)) index += 1;
    return `${base}_conflict-${index}${extension}`;
}

export function decideSyncAction(input: WorkspaceSyncActionInput): "upload" | "download" | "conflict" | "noop" {
    const { localMtime, remoteMtime, lastSyncedAt } = input;
    if (remoteMtime === undefined) return localMtime === undefined ? "noop" : "upload";
    if (localMtime === undefined) return "download";
    if (lastSyncedAt === undefined) return "conflict";
    const localChanged = localMtime > lastSyncedAt;
    const remoteChanged = remoteMtime > lastSyncedAt;
    if (localChanged && remoteChanged) return "conflict";
    if (remoteChanged) return "download";
    if (localChanged) return "upload";
    return "noop";
}

export function planWorkspaceSync(input: WorkspaceSyncPlanInput): WorkspaceSyncAction[] {
    const byName = new Map(input.files.map((file) => [file.name, file]));
    const used = new Set<string>();
    const actions = input.projects.map((project) => {
        const fileName = workspaceFileName(project.id, project.title);
        used.add(fileName);
        return {
            projectId: project.id,
            fileName,
            action: decideSyncAction({ localMtime: project.updatedAt, remoteMtime: byName.get(fileName)?.mtime, lastSyncedAt: input.lastSyncedAt[project.id] }),
        };
    });
    input.files.forEach((file) => {
        if (used.has(file.name)) return;
        actions.push({ projectId: "", fileName: file.name, action: decideSyncAction({ remoteMtime: file.mtime }) });
    });
    return actions;
}

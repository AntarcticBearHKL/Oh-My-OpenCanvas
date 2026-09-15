import { App, Button } from "antd";
import { FolderInput, FolderOpen, FolderX, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import type { WorkspaceSyncAction } from "@/lib/workspace/workspace-sync";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useWorkspaceStore } from "@/stores/use-workspace-store";

export function CanvasAssetLibrary({ theme }: { theme: CanvasTheme }) {
    const { t } = useTranslation();
    const { modal, message } = App.useApp();
    const supported = useWorkspaceStore((state) => state.supported);
    const directoryName = useWorkspaceStore((state) => state.directoryName);
    const status = useWorkspaceStore((state) => state.status);
    const lastSummary = useWorkspaceStore((state) => state.lastSummary);
    const bindDirectory = useWorkspaceStore((state) => state.bindDirectory);
    const unbind = useWorkspaceStore((state) => state.unbind);
    const restore = useWorkspaceStore((state) => state.restore);
    const syncNow = useWorkspaceStore((state) => state.syncNow);
    const resolveConflict = useWorkspaceStore((state) => state.resolveConflict);
    const projects = useCanvasStore((state) => state.projects);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void restore();
    }, [restore]);

    const bind = async () => {
        setBusy(true);
        const bound = await bindDirectory();
        setBusy(false);
        if (!bound) message.error(t("config.workspace.bindFailed"));
    };

    const askConflicts = async (conflicts: WorkspaceSyncAction[]) => {
        for (const conflict of conflicts) {
            await new Promise<void>((resolve) => {
                modal.confirm({
                    title: t("config.workspace.conflictTitle"),
                    content: t("config.workspace.conflictDescription", { fileName: conflict.fileName }),
                    okText: t("config.workspace.keepLocal"),
                    cancelText: t("config.workspace.keepRemote"),
                    closable: false,
                    maskClosable: false,
                    keyboard: false,
                    onOk: async () => {
                        await resolveConflict(conflict.projectId, "local");
                        resolve();
                    },
                    onCancel: async () => {
                        await resolveConflict(conflict.projectId, "remote");
                        resolve();
                    },
                });
            });
        }
        message.success(t("config.workspace.conflictResolved"));
    };

    const sync = async () => {
        setBusy(true);
        try {
            const summary = await syncNow(projects);
            const state = useWorkspaceStore.getState();
            if (state.status === "permissionDenied") {
                message.error(t("config.workspace.permissionDenied"));
                return;
            }
            if (state.status === "error") {
                message.error(t("config.workspace.syncFailed"));
                return;
            }
            if (!summary.uploaded && !summary.downloaded && !summary.conflicts) {
                message.info(t("config.workspace.nothingToSync"));
                return;
            }
            if (state.pendingConflicts.length) {
                await askConflicts(state.pendingConflicts);
                return;
            }
            message.success(t("config.workspace.syncDone", summary));
        } finally {
            setBusy(false);
        }
    };

    if (!supported) return null;

    return (
        <div className="mb-2 rounded-lg border px-2 py-1.5 text-[11px]" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
            <div className="flex min-w-0 items-center gap-1.5">
                <FolderOpen className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium" style={{ color: theme.node.text }}>
                    {directoryName || t("config.workspace.unbound")}
                </span>
                <span className="shrink-0">{t(`config.workspace.status.${status}`)}</span>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-0.5">
                <Button size="small" type="text" className="!h-6 !px-1.5 !text-[11px]" icon={<FolderInput className="size-3.5" />} loading={busy} onClick={() => void bind()}>
                    {directoryName ? t("config.workspace.rebind") : t("config.workspace.bind")}
                </Button>
                {directoryName ? (
                    <>
                        <Button size="small" type="text" className="!h-6 !px-1.5 !text-[11px]" icon={<RefreshCw className="size-3.5" />} disabled={busy} onClick={() => void sync()}>
                            {t("config.workspace.syncNow")}
                        </Button>
                        <Button size="small" type="text" danger className="!h-6 !px-1.5 !text-[11px]" icon={<FolderX className="size-3.5" />} disabled={busy} onClick={() => void unbind()}>
                            {t("config.workspace.unbind")}
                        </Button>
                    </>
                ) : null}
            </div>
            <div className="mt-1 truncate">{lastSummary ? t("config.workspace.lastSync", lastSummary) : t("config.workspace.neverSynced")}</div>
        </div>
    );
}

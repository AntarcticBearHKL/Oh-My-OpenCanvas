import { Alert, App, Button } from "antd";
import { FolderInput, FolderOpen, FolderX, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { WorkspaceSyncAction } from "@/lib/workspace/workspace-sync";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useWorkspaceStore } from "@/stores/use-workspace-store";

export function ConfigWorkspace() {
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

    if (!supported) {
        return <Alert type="warning" showIcon title={t("config.workspace.unsupported")} description={t("config.workspace.unsupportedDescription")} />;
    }

    return (
        <div className="space-y-3">
            <section className="rounded-lg border border-border p-4 dark:border-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <FolderOpen className="size-4" />
                            {t("config.workspace.title")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{t("config.workspace.description")}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button icon={<FolderInput className="size-4" />} loading={busy} onClick={() => void bind()}>
                            {directoryName ? t("config.workspace.rebind") : t("config.workspace.bind")}
                        </Button>
                        {directoryName ? (
                            <Button icon={<FolderX className="size-4" />} disabled={busy} onClick={() => void unbind()}>
                                {t("config.workspace.unbind")}
                            </Button>
                        ) : null}
                    </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted p-3 dark:bg-muted/70">
                        <div className="text-xs text-muted-foreground">{t("config.workspace.folderLabel")}</div>
                        <div className="mt-2 truncate text-sm font-medium">{directoryName || t("config.workspace.unbound")}</div>
                    </div>
                    <div className="rounded-lg bg-muted p-3 dark:bg-muted/70">
                        <div className="text-xs text-muted-foreground">{t("config.workspace.statusLabel")}</div>
                        <div className="mt-2 text-sm font-medium">{t(`config.workspace.status.${status}`)}</div>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                        {lastSummary ? t("config.workspace.lastSync", lastSummary) : t("config.workspace.neverSynced")}
                    </div>
                    <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!directoryName} loading={busy} onClick={() => void sync()}>
                        {t("config.workspace.syncNow")}
                    </Button>
                </div>
            </section>
            <Alert type="info" showIcon title={t("config.workspace.conflictHint")} />
        </div>
    );
}

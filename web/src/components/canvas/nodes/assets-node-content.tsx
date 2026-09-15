import { useEffect } from "react";
import { FileText, FolderInput, Music2, RefreshCw, Video, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ASSET_FOLDER_DRAG_MIME, ASSET_FOLDER_FILE_LIMIT } from "@/lib/canvas/asset-folder";
import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { useAssetFolderStore } from "@/stores/use-asset-folder-store";
import type { CanvasNodeData } from "@/types/canvas";

export function AssetsNodeContent({ node, onInsert, onOutputFolderBind, onOutputFolderUnbind }: { node: CanvasNodeData; onInsert: (file: File) => void; onOutputFolderBind: () => void; onOutputFolderUnbind: () => void }) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const folderName = useAssetFolderStore((state) => state.folderName);
    const files = useAssetFolderStore((state) => state.files);
    const capped = useAssetFolderStore((state) => state.capped);
    const failed = useAssetFolderStore((state) => state.failed);
    const supported = useAssetFolderStore((state) => state.supported);
    const collectStatus = useAssetFolderStore((state) => state.collectStatus);
    const bindFolder = useAssetFolderStore((state) => state.bindFolder);
    const refresh = useAssetFolderStore((state) => state.refresh);
    const outputFolderName = useAssetFolderStore((state) => state.outputFolderName);
    const outputStatus = useAssetFolderStore((state) => state.outputStatus);
    const bound = Boolean(folderName);
    const displayName = node.metadata?.assetFolderName || folderName;
    const collectLabel = collectStatus === "saving" ? t("canvas.assets.collectSaving") : collectStatus === "saved" ? t("canvas.assets.collectSaved") : collectStatus === "failed" ? t("canvas.assets.collectFailed") : "";
    const outputStatusLabel = outputStatus === "writing" ? t("canvas.assets.outputWriting") : outputStatus === "error" ? t("canvas.assets.outputFailed") : "";
    const outputLabel = outputFolderName || t("canvas.assets.outputUnbound");

    useEffect(() => {
        void useAssetFolderStore.getState().restore();
        void useAssetFolderStore.getState().restoreOutputFolder();
    }, []);

    useEffect(() => {
        if (collectStatus !== "saved") return;
        const timer = window.setTimeout(() => useAssetFolderStore.setState({ collectStatus: "idle" }), 2000);
        return () => window.clearTimeout(timer);
    }, [collectStatus]);

    return (
        <div className="flex h-full w-full flex-col gap-2 p-3 text-left">
            <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: theme.node.text }}>
                    {t("canvas.nodeTypes.assets")}
                </span>
                <button type="button" className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} onClick={() => void bindFolder()} onMouseDown={(event) => event.stopPropagation()}>
                    <FolderInput className="size-3.5" />
                    {bound ? t("canvas.assets.rebind") : t("canvas.assets.bind")}
                </button>
                <button
                    type="button"
                    className="grid size-7 shrink-0 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                    aria-label={t("canvas.assets.refresh")}
                    title={t("canvas.assets.refresh")}
                    onClick={() => void refresh()}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <RefreshCw className="size-3.5" />
                </button>
            </div>

            {bound ? (
                <div className="truncate text-[10px]" style={{ color: theme.node.muted }}>
                    {displayName}
                </div>
            ) : null}

            {collectLabel ? (
                <div className="truncate text-[10px]" style={{ color: collectStatus === "failed" ? theme.node.text : theme.node.muted }}>
                    {collectLabel}
                </div>
            ) : null}

            {bound ? (
                <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto" onWheel={(event) => event.stopPropagation()}>
                    {files.length ? (
                        <div className="grid grid-cols-3 gap-2">
                            {files.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = "copy";
                                        event.dataTransfer.setData(ASSET_FOLDER_DRAG_MIME, item.id);
                                        event.dataTransfer.setData("text/plain", item.name);
                                    }}
                                    onClick={() => onInsert(item.file)}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    className="group flex cursor-grab flex-col gap-1 overflow-hidden rounded-lg text-left active:cursor-grabbing"
                                    title={item.name}
                                >
                                    <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg">
                                        {item.kind === "image" ? (
                                            <img src={item.url} alt="" draggable={false} className="size-full object-cover" />
                                        ) : item.kind === "video" ? (
                                            <Video className="size-5 opacity-45" />
                                        ) : item.kind === "audio" ? (
                                            <Music2 className="size-5 opacity-45" />
                                        ) : (
                                            <FileText className="size-5 opacity-45" />
                                        )}
                                    </div>
                                    <span className="truncate text-[10px] leading-4" style={{ color: theme.node.muted }}>
                                        {item.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="grid h-full place-items-center px-4 text-center text-[11px]" style={{ color: theme.node.placeholder }}>
                            {t("canvas.assets.empty")}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" style={{ color: theme.node.placeholder }}>
                    <FolderInput className="size-6 opacity-35" />
                    <span className="px-4 text-[11px] leading-5">{t("canvas.assets.unbound")}</span>
                </div>
            )}

            <div className="flex shrink-0 items-center justify-between gap-2 text-[10px]" style={{ color: theme.node.muted }}>
                <span>{t("canvas.assets.count", { count: files.length })}</span>
                <span className="truncate">
                    {failed ? t("canvas.assets.scanFailed") : capped ? t("canvas.assets.capped", { count: ASSET_FOLDER_FILE_LIMIT }) : files.length ? t("canvas.assets.dropHint") : ""}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 border-t pt-2 text-[10px]" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                <FolderInput className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{outputStatusLabel ? `${outputLabel} · ${outputStatusLabel}` : outputLabel}</span>
                {supported ? (
                    <>
                        <button
                            type="button"
                            className="flex h-6 shrink-0 items-center rounded-md px-1.5 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: theme.node.text }}
                            onClick={onOutputFolderBind}
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            {outputFolderName ? t("canvas.assets.outputRebind") : t("canvas.assets.outputBind")}
                        </button>
                        {outputFolderName ? (
                            <button
                                type="button"
                                className="grid size-6 shrink-0 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
                                style={{ color: theme.node.text }}
                                aria-label={t("canvas.assets.outputUnbind")}
                                title={t("canvas.assets.outputUnbind")}
                                onClick={onOutputFolderUnbind}
                                onMouseDown={(event) => event.stopPropagation()}
                            >
                                <X className="size-3.5" />
                            </button>
                        ) : null}
                    </>
                ) : (
                    <span className="shrink-0 text-[10px]">{t("canvas.assets.outputUnsupported")}</span>
                )}
            </div>
        </div>
    );
}

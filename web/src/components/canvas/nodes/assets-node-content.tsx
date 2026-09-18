import { useEffect } from "react";
import { FolderInput, PlugZap, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BROWSER_CACHE_DRAG_MIME, getBrowserCacheFile } from "@/services/api/browser-cache";
import { ASSET_FOLDER_DRAG_MIME, ASSET_FOLDER_FILE_LIMIT } from "@/lib/canvas/asset-folder";
import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { useAssetFolderStore } from "@/stores/use-asset-folder-store";
import { useBrowserCacheStore } from "@/stores/use-browser-cache-store";
import type { CanvasAssetSource, CanvasNodeData } from "@/types/canvas";

export function AssetsNodeContent({ node, onInsert, onSourceChange }: { node: CanvasNodeData; onInsert: (file: File) => void; onSourceChange: (source: CanvasAssetSource) => void }) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const binding = useAssetFolderStore((state) => state.folders[node.id]);
    const bindFolder = useAssetFolderStore((state) => state.bindFolder);
    const refresh = useAssetFolderStore((state) => state.refresh);
    const cacheStatus = useBrowserCacheStore((state) => state.status);
    const cacheItems = useBrowserCacheStore((state) => state.items);
    const initCache = useBrowserCacheStore((state) => state.init);
    const source: CanvasAssetSource = node.metadata?.assetSource === "cache" ? "cache" : "folder";
    const files = binding?.files || [];
    const bound = Boolean(binding?.folderName);
    const collectLabel = binding?.collectStatus === "saving" ? t("canvas.assets.collectSaving") : binding?.collectStatus === "saved" ? t("canvas.assets.collectSaved") : binding?.collectStatus === "failed" ? t("canvas.assets.collectFailed") : "";
    const statusLabel = collectLabel || (binding?.failed ? t("canvas.assets.scanFailed") : binding?.capped ? t("canvas.assets.capped", { count: ASSET_FOLDER_FILE_LIMIT }) : files.length ? t("canvas.assets.dropHint") : "");
    const cachedItems = cacheItems.slice(0, ASSET_FOLDER_FILE_LIMIT);
    const cacheStatusLabel = cacheItems.length > ASSET_FOLDER_FILE_LIMIT ? t("canvas.assets.capped", { count: ASSET_FOLDER_FILE_LIMIT }) : "";

    useEffect(() => {
        void useAssetFolderStore.getState().restore(node.id);
    }, [node.id]);

    useEffect(() => {
        if (binding?.collectStatus !== "saved") return;
        const timer = window.setTimeout(() => useAssetFolderStore.getState().setCollectStatus(node.id, "idle"), 2000);
        return () => window.clearTimeout(timer);
    }, [binding?.collectStatus, node.id]);

    const insertCached = async (itemId: string) => {
        const file = await getBrowserCacheFile(itemId);
        if (file) onInsert(file);
    };

    return (
        <div className="flex h-full w-full flex-col gap-2 p-3 text-left">
            <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: theme.node.text }}>
                    {t("canvas.nodeTypes.assets")}
                </span>
                {source === "folder" && (
                    <button type="button" className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} onClick={() => void bindFolder(node.id)} onMouseDown={(event) => event.stopPropagation()}>
                        <FolderInput className="size-3.5" />
                        {bound ? t("canvas.assets.rebind") : t("canvas.assets.bind")}
                    </button>
                )}
                <button
                    type="button"
                    className="grid size-7 shrink-0 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                    aria-label={t("canvas.assets.refresh")}
                    title={t("canvas.assets.refresh")}
                    onClick={() => void (source === "cache" ? initCache() : refresh(node.id))}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <RefreshCw className="size-3.5" />
                </button>
            </div>

            <div className="flex shrink-0 items-center gap-0.5" onMouseDown={(event) => event.stopPropagation()}>
                {(["folder", "cache"] as const).map((item) => (
                    <button
                        key={item}
                        type="button"
                        className="h-6 shrink-0 rounded-md px-2 text-[11px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: source === item ? theme.node.text : theme.node.muted }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={() => {
                            if (source === item) return;
                            onSourceChange(item);
                            if (item === "cache") initCache();
                        }}
                    >
                        {t(item === "folder" ? "canvas.assets.sourceFolder" : "canvas.assets.sourceCache")}
                    </button>
                ))}
            </div>

            {source === "cache" ? (
                cacheStatus === "ready" ? (
                    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto" onWheel={(event) => event.stopPropagation()}>
                        {cachedItems.length ? (
                            <div className="flex flex-col gap-0.5">
                                {cachedItems.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        draggable
                                        onDragStart={(event) => {
                                            event.dataTransfer.effectAllowed = "copy";
                                            event.dataTransfer.setData(BROWSER_CACHE_DRAG_MIME, JSON.stringify({ nodeId: node.id, itemId: item.id }));
                                            event.dataTransfer.setData("text/plain", item.name);
                                        }}
                                        onClick={() => void insertCached(item.id)}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        className="w-full cursor-grab truncate rounded px-1.5 py-1 text-left text-[11px] transition hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"
                                        style={{ color: theme.node.text }}
                                        title={item.name}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="grid h-full place-items-center px-4 text-center text-[11px]" style={{ color: theme.node.placeholder }}>
                                {t("canvas.assets.cacheEmpty")}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" style={{ color: theme.node.placeholder }}>
                        <PlugZap className="size-6 opacity-35" />
                        <span className="px-4 text-[11px] leading-5">{cacheStatus === "connecting" ? t("canvas.assets.cacheConnecting") : t("canvas.assets.cacheUnavailable")}</span>
                        {cacheStatus === "unavailable" && <span className="px-4 text-[10px] leading-4">{t("canvas.assets.cacheInstallHint")}</span>}
                    </div>
                )
            ) : bound ? (
                <>
                    <div className="truncate text-[10px]" style={{ color: theme.node.muted }}>
                        {binding?.folderName}
                    </div>
                    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto" onWheel={(event) => event.stopPropagation()}>
                        {files.length ? (
                            <div className="flex flex-col gap-0.5">
                                {files.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        draggable
                                        onDragStart={(event) => {
                                            event.dataTransfer.effectAllowed = "copy";
                                            event.dataTransfer.setData(ASSET_FOLDER_DRAG_MIME, JSON.stringify({ nodeId: node.id, fileId: item.id }));
                                            event.dataTransfer.setData("text/plain", item.name);
                                        }}
                                        onClick={() => onInsert(item.file)}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        className="w-full cursor-grab truncate rounded px-1.5 py-1 text-left text-[11px] transition hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"
                                        style={{ color: theme.node.text }}
                                        title={item.name}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="grid h-full place-items-center px-4 text-center text-[11px]" style={{ color: theme.node.placeholder }}>
                                {t("canvas.assets.empty")}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" style={{ color: theme.node.placeholder }}>
                    <FolderInput className="size-6 opacity-35" />
                    <span className="px-4 text-[11px] leading-5">{t("canvas.assets.unbound")}</span>
                </div>
            )}

            <div className="flex shrink-0 items-center justify-between gap-2 text-[10px]" style={{ color: theme.node.muted }}>
                <span>{source === "cache" ? t("canvas.assets.cacheCount", { count: cacheItems.length }) : t("canvas.assets.count", { count: files.length })}</span>
                <span className="truncate">{source === "cache" ? cacheStatusLabel : statusLabel}</span>
            </div>
        </div>
    );
}

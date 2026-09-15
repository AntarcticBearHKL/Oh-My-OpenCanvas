import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { App, Button, Dropdown, Empty, Input, Popconfirm, Segmented, Tag } from "antd";
import { Check, ChevronRight, FolderInput, FolderPlus, PanelLeftClose, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { frostedSurfaceLargeClass, type CanvasTheme } from "@/lib/canvas-theme";
import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { cn } from "@/lib/utils";
import { uploadMediaFile } from "@/services/file-storage";
import { uploadImage } from "@/services/image-storage";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { CANVAS_SIDE_PANEL_MAX_WIDTH, CANVAS_SIDE_PANEL_MIN_WIDTH, CANVAS_SIDE_PANEL_MOTION_MS, useCanvasSidePanelStore } from "@/stores/use-canvas-side-panel-store";

import type { InsertAssetPayload } from "./asset-picker-modal";
import { CanvasSwitcherTab } from "./canvas-switcher";

const PANEL_MOTION_SECONDS = CANVAS_SIDE_PANEL_MOTION_MS / 1000;
const PANEL_EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
    onInsertAsset: (payload: InsertAssetPayload) => void;
};

export function CanvasSidePanel({ onInsertAsset }: Props) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const width = useCanvasSidePanelStore((state) => state.width);
    const panelOpen = useCanvasSidePanelStore((state) => state.panelOpen);
    const panelMounted = useCanvasSidePanelStore((state) => state.panelMounted);
    const panelClosing = useCanvasSidePanelStore((state) => state.panelClosing);
    const setWidth = useCanvasSidePanelStore((state) => state.setWidth);
    const closePanel = useCanvasSidePanelStore((state) => state.closePanel);
    const [resizing, setResizing] = useState(false);
    const [panelTab, setPanelTab] = useState<"assets" | "canvases">("assets");

    const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        let nextWidth = startWidth;
        const onMove = (moveEvent: PointerEvent) => {
            nextWidth = Math.min(CANVAS_SIDE_PANEL_MAX_WIDTH, Math.max(CANVAS_SIDE_PANEL_MIN_WIDTH, startWidth + moveEvent.clientX - startX));
            setWidth(nextWidth);
        };
        const onUp = () => {
            localStorage.setItem("canvas-side-panel-width", String(nextWidth));
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            setResizing(false);
        };
        setResizing(true);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    if (!panelMounted) return null;

    return (
        <motion.div
            className="relative z-[60] flex h-full shrink-0 max-md:absolute max-md:bottom-0 max-md:left-0 max-md:top-16 max-md:h-auto max-md:max-w-[85vw]"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: panelOpen ? width + 1 : 0, opacity: panelOpen ? 1 : 0 }}
            transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: PANEL_EASE }}
            style={{ overflow: "clip", pointerEvents: panelClosing ? "none" : undefined }}
        >
            <motion.aside
                className={`relative flex h-full shrink-0 flex-col overflow-hidden border-r max-md:max-w-[85vw] ${frostedSurfaceLargeClass}`}
                initial={{ x: -48 }}
                animate={{ x: panelClosing ? -28 : 0 }}
                transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: PANEL_EASE }}
                style={{ width, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                data-canvas-no-zoom
            >
                <div className="flex items-center gap-2 px-3 pt-3.5">
                    <Segmented
                        size="small"
                        value={panelTab}
                        onChange={(value) => setPanelTab(value as "assets" | "canvases")}
                        options={[
                            { value: "assets", label: t("canvas.sidePanel.assets") },
                            { value: "canvases", label: t("canvas.sidePanel.canvases") },
                        ]}
                    />
                    <button type="button" onClick={closePanel} className="ml-auto grid size-7 place-items-center rounded-md opacity-55 transition hover:bg-black/5 hover:opacity-100 md:hidden dark:hover:bg-card/10" aria-label={t("canvas.collapsePanel")}>
                        <PanelLeftClose className="size-4" />
                    </button>
                </div>
                <div className="mt-2 min-h-0 flex-1 overflow-hidden">{panelTab === "assets" ? <CanvasAssetsTab onInsert={onInsertAsset} theme={theme} /> : <CanvasSwitcherTab theme={theme} />}</div>
                <button type="button" className="absolute inset-y-0 right-0 z-40 w-4 translate-x-1/2 cursor-col-resize" onPointerDown={startResize} aria-label={t("canvas.sidePanel.resize")} />
            </motion.aside>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// Assets tab: collapsible type groups, tag filtering, and click-to-insert.
// ---------------------------------------------------------------------------

const UNGROUPED_SECTION_ID = "__ungrouped__";

function buildInsertPayload(asset: Asset): InsertAssetPayload {
    if (asset.kind === "text") return { kind: "text", content: asset.data.content, title: asset.title };
    if (asset.kind === "video") return { kind: "video", url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, width: asset.data.width, height: asset.data.height };
    return { kind: "image", dataUrl: asset.data.dataUrl, storageKey: asset.data.storageKey, title: asset.title };
}

const CanvasAssetsTab = memo(function CanvasAssetsTab({ onInsert, theme }: { onInsert: (payload: InsertAssetPayload) => void; theme: CanvasTheme }) {
    const { message, modal } = App.useApp();
    const { t } = useTranslation();
    const assets = useAssetStore((state) => state.assets);
    const groups = useAssetStore((state) => state.groups);
    const addAsset = useAssetStore((state) => state.addAsset);
    const removeAsset = useAssetStore((state) => state.removeAsset);
    const createAssetGroup = useAssetStore((state) => state.createAssetGroup);
    const renameAssetGroup = useAssetStore((state) => state.renameAssetGroup);
    const deleteAssetGroup = useAssetStore((state) => state.deleteAssetGroup);
    const [keyword, setKeyword] = useState("");
    const [tagFilter, setTagFilter] = useState<string>("all");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const allTags = useMemo(() => Array.from(new Set(assets.flatMap((asset) => asset.tags || []))).slice(0, 20), [assets]);

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return assets.filter((asset) => (tagFilter === "all" || (asset.tags || []).includes(tagFilter)) && (!query || [asset.title, ...(asset.tags || [])].join(" ").toLowerCase().includes(query)));
    }, [assets, keyword, tagFilter]);

    const sections = useMemo(() => {
        const isUngrouped = (asset: Asset) => !asset.groupId || !groups.some((group) => group.id === asset.groupId);
        return [
            ...groups.map((group) => ({ id: group.id, name: group.name, group, items: filtered.filter((asset) => asset.groupId === group.id) })),
            { id: UNGROUPED_SECTION_ID, name: t("canvas.sidePanel.group.ungrouped"), group: null, items: filtered.filter(isUngrouped) },
        ];
    }, [filtered, groups, t]);

    const addGroup = () => {
        const name = t("canvas.sidePanel.group.defaultName", { count: groups.length + 1 });
        setEditingGroupId(createAssetGroup(name));
        setEditingGroupName(name);
    };

    const saveGroupName = () => {
        if (editingGroupId) renameAssetGroup(editingGroupId, editingGroupName);
        setEditingGroupId(null);
    };

    const removeGroup = (id: string) => {
        setEditingGroupId(null);
        modal.confirm({
            title: t("canvas.sidePanel.group.deleteTitle"),
            content: t("canvas.sidePanel.group.deleteDescription"),
            okText: t("common.delete"),
            okButtonProps: { danger: true },
            cancelText: t("common.cancel"),
            onOk: () => deleteAssetGroup(id),
        });
    };

    const handleFiles = async (fileList: FileList | null) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        setUploading(true);
        const hide = message.loading(t("canvas.sidePanel.addingAssets"), 0);
        let added = 0;
        try {
            for (const file of files) {
                if (file.type.startsWith("image/")) {
                    const image = await uploadImage(file);
                    addAsset({ kind: "image", title: file.name || t("assets.kinds.image"), coverUrl: image.url, tags: [], data: { dataUrl: image.url, storageKey: image.storageKey, width: image.width, height: image.height, bytes: image.bytes, mimeType: image.mimeType } });
                    added += 1;
                } else if (file.type.startsWith("video/")) {
                    const media = await uploadMediaFile(file, "video");
                    addAsset({ kind: "video", title: file.name || t("assets.kinds.video"), coverUrl: "", tags: [], data: { url: media.url, storageKey: media.storageKey, width: media.width || 0, height: media.height || 0, bytes: media.bytes, mimeType: media.mimeType } });
                    added += 1;
                }
            }
            if (added) message.success(t("canvas.sidePanel.addedAssets", { count: added }));
            else message.warning(t("canvas.sidePanel.mediaOnly"));
        } catch (error) {
            console.error(error);
            message.error(t("canvas.sidePanel.addFailed"));
        } finally {
            hide();
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <Input size="small" allowClear className="min-w-0 flex-1" prefix={<Search className="size-3.5 text-muted-foreground" />} placeholder={t("canvas.sidePanel.searchAssets")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <button
                    type="button"
                    onClick={addGroup}
                    className="grid size-6 shrink-0 place-items-center rounded-md opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-card/10"
                    aria-label={t("canvas.sidePanel.group.create")}
                    title={t("canvas.sidePanel.group.create")}
                >
                    <FolderPlus className="size-3.5" />
                </button>
                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-card/10"
                    style={{ color: theme.node.text }}
                >
                    <Plus className="size-3.5" />
                    {t("canvas.sidePanel.add")}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
            </div>
            {allTags.length ? (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                    <Tag.CheckableTag checked={tagFilter === "all"} className={cn("prompt-filter-tag", tagFilter === "all" && "is-active")} onChange={() => setTagFilter("all")}>
                        {t("common.all")}
                    </Tag.CheckableTag>
                    {allTags.map((tag) => (
                        <Tag.CheckableTag key={tag} checked={tagFilter === tag} className={cn("prompt-filter-tag", tagFilter === tag && "is-active")} onChange={() => setTagFilter((prev) => (prev === tag ? "all" : tag))}>
                            {tag}
                        </Tag.CheckableTag>
                    ))}
                </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {assets.length ? (
                    <div className="space-y-1">
                        {sections.map((section) => {
                            const isCollapsed = collapsed[section.id];
                            const group = section.group;
                            const groupId = group?.id ?? "";
                            const groupName = group?.name ?? "";
                            return (
                                <div key={section.id} className="group/section">
                                    {group && editingGroupId === group.id ? (
                                        <div className="flex items-center gap-1 px-1.5 py-1">
                                            <Input
                                                size="small"
                                                className="min-w-0 flex-1"
                                                value={editingGroupName}
                                                onChange={(event) => setEditingGroupName(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") saveGroupName();
                                                    if (event.key === "Escape") setEditingGroupId(null);
                                                }}
                                                autoFocus
                                            />
                                            <Button type="text" size="small" shape="circle" icon={<Check className="size-3.5" />} onClick={saveGroupName} aria-label={t("common.save")} title={t("common.save")} />
                                            <Button type="text" size="small" shape="circle" icon={<X className="size-3.5" />} onClick={() => setEditingGroupId(null)} aria-label={t("common.cancel")} title={t("common.cancel")} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 rounded-md px-1.5 py-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setCollapsed((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-semibold opacity-75 transition hover:opacity-100"
                                            >
                                                <ChevronRight className={cn("size-3.5 transition-transform", !isCollapsed && "rotate-90")} />
                                                <span className="min-w-0 flex-1 truncate">{section.name}</span>
                                                <span className="opacity-50">{section.items.length}</span>
                                            </button>
                                            {group ? (
                                                <div className="hidden shrink-0 items-center group-hover/section:flex">
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        shape="circle"
                                                        icon={<Pencil className="size-3" />}
                                                        onClick={() => {
                                                            setEditingGroupId(groupId);
                                                            setEditingGroupName(groupName);
                                                        }}
                                                        aria-label={t("canvas.sidePanel.group.rename")}
                                                        title={t("canvas.sidePanel.group.rename")}
                                                    />
                                                    <Button type="text" size="small" shape="circle" icon={<Trash2 className="size-3" />} onClick={() => removeGroup(groupId)} aria-label={t("canvas.sidePanel.group.delete")} title={t("canvas.sidePanel.group.delete")} />
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                    {isCollapsed ? null : (
                                        <div className="grid grid-cols-2 gap-2 px-1 pb-2 pt-1">
                                            {section.items.map((asset) => (
                                                <AssetCard key={asset.id} asset={asset} theme={theme} onInsert={() => onInsert(buildInsertPayload(asset))} onRemove={() => (removeAsset(asset.id), message.success(t("canvas.sidePanel.assetRemoved")))} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.sidePanel.noAssets")} className="pt-16" />
                )}
            </div>
        </div>
    );
});

function AssetCard({ asset, theme, onInsert, onRemove }: { asset: Asset; theme: CanvasTheme; onInsert: () => void; onRemove: () => void }) {
    const { t } = useTranslation();
    const groups = useAssetStore((state) => state.groups);
    const setAssetGroup = useAssetStore((state) => state.setAssetGroup);
    return (
        <div
            draggable
            onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData("application/x-infinite-canvas-asset", JSON.stringify(buildInsertPayload(asset)));
            }}
            className="group relative aspect-square cursor-grab overflow-hidden rounded-xl border transition duration-200 hover:-translate-y-0.5 active:cursor-grabbing"
            style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel }}
        >
            <AssetCover asset={asset} />
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 transition duration-200 group-hover:opacity-100">
                <button
                    type="button"
                    onClick={onInsert}
                    className="grid size-7 place-items-center rounded-full bg-card/90 text-foreground backdrop-blur transition hover:bg-card hover:text-foreground dark:bg-black/60 dark:text-foreground dark:hover:bg-black/80"
                    aria-label={t("canvas.sidePanel.inserted")}
                    title={t("canvas.sidePanel.inserted")}
                >
                    <Plus className="size-3.5" />
                </button>
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        items: [{ key: UNGROUPED_SECTION_ID, label: t("canvas.sidePanel.group.ungrouped") }, ...groups.map((group) => ({ key: group.id, label: group.name }))],
                        selectable: true,
                        selectedKeys: [asset.groupId || UNGROUPED_SECTION_ID],
                        onClick: ({ key }) => setAssetGroup(asset.id, key === UNGROUPED_SECTION_ID ? null : key),
                    }}
                >
                    <button
                        type="button"
                        className="grid size-7 place-items-center rounded-full bg-card/90 text-foreground backdrop-blur transition hover:bg-card hover:text-foreground dark:bg-black/60 dark:text-foreground dark:hover:bg-black/80"
                        aria-label={t("canvas.sidePanel.group.move")}
                        title={t("canvas.sidePanel.group.move")}
                    >
                        <FolderInput className="size-3.5" />
                    </button>
                </Dropdown>
                <Popconfirm title={t("canvas.sidePanel.removeAssetTitle")} okText={t("canvas.sidePanel.remove")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }} onConfirm={onRemove}>
                    <button
                        type="button"
                        className="grid size-7 place-items-center rounded-full bg-card/90 text-foreground backdrop-blur transition hover:bg-card hover:text-red-500 dark:bg-black/60 dark:text-foreground dark:hover:bg-black/80 dark:hover:text-red-400"
                        aria-label={t("canvas.sidePanel.removeAsset")}
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </Popconfirm>
            </div>
        </div>
    );
}

function AssetCover({ asset }: { asset: Asset }) {
    if (asset.kind === "text") return <div className="size-full overflow-hidden whitespace-pre-wrap break-words p-2.5 text-[11px] leading-snug opacity-80">{asset.data.content}</div>;
    if (asset.kind === "video") {
        if (asset.coverUrl) return <img src={asset.coverUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" />;
        return <video src={`${asset.data.url}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" />;
    }
    return <img src={asset.coverUrl || asset.data.dataUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" />;
}



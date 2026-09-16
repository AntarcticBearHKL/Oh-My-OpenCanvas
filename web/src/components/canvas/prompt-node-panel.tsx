import { useState, type UIEvent } from "react";
import { Empty, Input, Modal, Spin } from "antd";
import { Library, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { ALL_PROMPTS_OPTION, type Prompt } from "@/services/api/prompts";
import { CANVAS_REFERENCE_DRAG_TYPE, type CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import type { CanvasNodeData } from "@/types/canvas";
import { CanvasPromptChipInput } from "./canvas-prompt-chip-input";

export function PromptNodePanel({ node, references = [], onContentChange }: { node: CanvasNodeData; references?: CanvasResourceReference[]; onContentChange: (nodeId: string, content: string) => void }) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div className="flex h-full w-full cursor-move flex-col px-3 pb-3 pt-7 text-sm" style={{ color: theme.node.text }}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="shrink-0 text-sm font-semibold">{t("canvas.nodeTypes.prompt")}</div>
                <button
                    type="button"
                    className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setPickerOpen(true)}
                >
                    <Library className="size-3.5" />
                    {t("canvas.promptNode.pick")}
                </button>
            </div>
            <PromptReferenceChips references={references} />
            <div className="flex min-h-0 flex-1 flex-col" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
                <CanvasPromptChipInput
                    value={node.metadata?.prompt || ""}
                    references={references}
                    onChange={(value) => onContentChange(node.id, value)}
                    containerClassName="min-h-0 flex-1"
                    className="thin-scrollbar h-full min-h-0 w-full cursor-text rounded-xl px-2 py-1.5 text-sm leading-6"
                    style={{ background: "transparent", color: theme.node.text }}
                    placeholder={t("canvas.promptNode.placeholder")}
                />
            </div>
            <PromptLibraryPicker open={pickerOpen} onSelect={(item) => (onContentChange(node.id, item.prompt), setPickerOpen(false))} onClose={() => setPickerOpen(false)} />
        </div>
    );
}

function PromptReferenceChips({ references }: { references: CanvasResourceReference[] }) {
    const theme = useCanvasTheme();
    const { t } = useTranslation();
    const images = references.filter((reference) => reference.kind === "image");
    if (!images.length) return null;

    return (
        <div
            className="mb-2 flex max-w-full shrink-0 flex-wrap items-center gap-1"
            title={t("canvas.promptNode.dragHint")}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {images.map((reference) => (
                <div
                    key={reference.id}
                    draggable
                    className="canvas-prompt-ref-chip flex h-7 max-w-32 cursor-grab items-center gap-1 overflow-hidden rounded-md border px-1 text-[11px] leading-none"
                    style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke, color: theme.node.text }}
                    title={reference.title || reference.label}
                    onDragStart={(event) => {
                        event.dataTransfer.setData(CANVAS_REFERENCE_DRAG_TYPE, reference.id);
                        event.dataTransfer.effectAllowed = "copy";
                        event.currentTarget.classList.add("canvas-prompt-ref-chip-dragging");
                    }}
                    onDragEnd={(event) => event.currentTarget.classList.remove("canvas-prompt-ref-chip-dragging")}
                >
                    {reference.previewUrl ? <img src={reference.previewUrl} alt="" draggable={false} className="size-5 shrink-0 rounded object-cover" /> : null}
                    <span className="truncate">{reference.label}</span>
                </div>
            ))}
        </div>
    );
}

function PromptLibraryPicker({ open, onSelect, onClose }: { open: boolean; onSelect: (item: Prompt) => void; onClose: () => void }) {
    const { t } = useTranslation();
    const [keyword, setKeyword] = useState("");
    const { query, items } = usePromptList({ keyword, tags: [], category: ALL_PROMPTS_OPTION, enabled: open });

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 120) void query.fetchNextPage();
    };

    return (
        <Modal title={t("canvas.promptNode.pickerTitle")} open={open} onCancel={onClose} footer={null} width={560} centered>
            <Input allowClear prefix={<Search className="size-3.5 opacity-60" />} placeholder={t("canvas.promptNode.search")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <div className="thin-scrollbar mt-3 max-h-[52vh] overflow-y-auto" onScroll={handleListScroll}>
                {query.isLoading ? (
                    <div className="flex justify-center py-10">
                        <Spin />
                    </div>
                ) : items.length ? (
                    <div className="space-y-1">
                        {items.map((item) => (
                            <button
                                key={`${item.sourceId}:${item.id}`}
                                type="button"
                                className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-black/5 dark:hover:bg-card/5"
                                onClick={() => onSelect(item)}
                            >
                                <div className="truncate text-sm font-medium">{item.title}</div>
                                <div className="mt-0.5 line-clamp-2 text-xs opacity-55">{item.prompt}</div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.promptNode.empty")} className="py-10" />
                )}
            </div>
        </Modal>
    );
}

import { useState, type UIEvent } from "react";
import { Empty, Input, Modal, Spin } from "antd";
import { Library, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { frostedSurfaceClass } from "@/lib/canvas-theme";
import { ALL_PROMPTS_OPTION, type Prompt } from "@/services/api/prompts";
import type { CanvasNodeData } from "@/types/canvas";

export function PromptNodePanel({ node, onContentChange }: { node: CanvasNodeData; onContentChange: (nodeId: string, content: string) => void }) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div
            data-canvas-no-zoom
            className={`rounded-2xl border p-3 ${frostedSurfaceClass}`}
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: theme.node.text }}
                onClick={() => setPickerOpen(true)}
            >
                <Library className="size-3.5" />
                {t("canvas.promptNode.pick")}
            </button>
            <textarea
                value={node.metadata?.prompt || ""}
                placeholder={t("canvas.promptNode.placeholder")}
                className="thin-scrollbar mt-1 h-40 w-full cursor-text resize-none rounded-xl px-3 py-2 text-sm leading-5 outline-none"
                style={{ background: "transparent", color: theme.node.text }}
                onChange={(event) => onContentChange(node.id, event.target.value)}
            />
            <PromptLibraryPicker open={pickerOpen} onSelect={(item) => (onContentChange(node.id, item.prompt), setPickerOpen(false))} onClose={() => setPickerOpen(false)} />
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
                                className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
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

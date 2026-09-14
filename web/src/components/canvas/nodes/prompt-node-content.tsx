import { useEffect, useRef, useState, type UIEvent } from "react";
import { Empty, Input, Modal, Spin } from "antd";
import { Library, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePromptList } from "@/components/prompts/use-prompt-list";
import { CanvasResourceMentionTextarea } from "@/components/canvas/canvas-resource-mention-textarea";
import { ALL_PROMPTS_OPTION, type Prompt } from "@/services/api/prompts";
import type { CanvasTheme } from "@/lib/canvas-theme";
import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import type { CanvasNodeData } from "@/types/canvas";

type PromptContentProps = {
    node: CanvasNodeData;
    theme: CanvasTheme;
    mentionReferences: CanvasResourceReference[];
    onContentChange: (nodeId: string, content: string) => void;
};

export function PromptContent({ node, theme, mentionReferences, onContentChange }: PromptContentProps) {
    const { t } = useTranslation();
    const prompt = node.metadata?.prompt || "";
    const [isEditing, setIsEditing] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!isEditing) return;
        const textarea = textareaRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    }, [isEditing]);

    useEffect(() => {
        if (!isEditing) return;
        const handleOutsidePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && textareaRef.current?.contains(event.target)) return;
            setIsEditing(false);
        };
        window.addEventListener("pointerdown", handleOutsidePointerDown, true);
        return () => window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }, [isEditing]);

    return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl p-4">
            <div className="mb-2 flex shrink-0 items-center justify-end">
                <button
                    type="button"
                    className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.muted }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        setPickerOpen(true);
                    }}
                >
                    <Library className="size-3.5" />
                    {t("canvas.promptNode.pick")}
                </button>
            </div>
            <div
                className="min-h-0 flex-1"
                onDoubleClick={(event) => {
                    event.stopPropagation();
                    setIsEditing(true);
                }}
            >
                {isEditing ? (
                    <CanvasResourceMentionTextarea
                        ref={textareaRef}
                        className="thin-scrollbar block h-full w-full resize-none overflow-y-auto whitespace-pre-wrap break-words border-none bg-transparent p-0 font-mono text-sm leading-6 outline-none select-text appearance-none"
                        style={{ color: theme.node.text }}
                        value={prompt}
                        references={mentionReferences}
                        highlightLabels={false}
                        onChange={(value) => onContentChange(node.id, value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setIsEditing(false);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onWheel={(event) => event.stopPropagation()}
                    />
                ) : prompt ? (
                    <div className="line-clamp-6 whitespace-pre-wrap break-words font-mono text-sm leading-6" style={{ color: theme.node.text }}>
                        {prompt}
                    </div>
                ) : (
                    <div className="font-mono text-sm" style={{ color: theme.node.placeholder }}>
                        {t("canvas.promptNode.placeholder")}
                    </div>
                )}
            </div>
            <PromptPicker open={pickerOpen} onSelect={(item) => (onContentChange(node.id, item.prompt), setPickerOpen(false))} onClose={() => setPickerOpen(false)} />
        </div>
    );
}

function PromptPicker({ open, onSelect, onClose }: { open: boolean; onSelect: (item: Prompt) => void; onClose: () => void }) {
    const { t } = useTranslation();
    const [keyword, setKeyword] = useState("");
    const { query, items } = usePromptList({ keyword, tags: [], category: ALL_PROMPTS_OPTION, enabled: open });

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 120) void query.fetchNextPage();
    };

    return (
        <Modal title={t("canvas.promptNode.pickerTitle")} open={open} onCancel={onClose} footer={null} width={560} centered>
            <Input allowClear prefix={<Search className="size-3.5 text-stone-400" />} placeholder={t("canvas.promptNode.search")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
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

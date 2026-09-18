import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import { normalizeVideoMode } from "@/lib/video-generation";
import type { CanvasNodeData, CanvasVideoMode, CanvasVideoSlot, CanvasVideoSlots } from "@/types/canvas";
import { selectionBlue } from "../canvas-node";
import { CanvasPromptChipInput } from "../canvas-prompt-chip-input";

export const MAX_VIDEO_REFERENCE_SLOTS = 4;

const videoModeOptions: CanvasVideoMode[] = ["frames", "reference"];

type VideoPromptNodeContentProps = {
    node: CanvasNodeData;
    nodes: CanvasNodeData[];
    references: CanvasResourceReference[];
    dropSlot?: CanvasVideoSlot | null;
    onContentChange: (nodeId: string, content: string) => void;
    onVideoModeChange: (nodeId: string, mode: CanvasVideoMode) => void;
    onVideoSlotsChange: (nodeId: string, slots: CanvasVideoSlots) => void;
};

export function VideoPromptNodeContent({ node, nodes, references, dropSlot, onContentChange, onVideoModeChange, onVideoSlotsChange }: VideoPromptNodeContentProps) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const [editing, setEditing] = useState(false);
    const slots = node.metadata?.videoSlots || {};
    const mode = normalizeVideoMode(node.metadata?.videoMode);
    const thumbnailById = new Map(nodes.map((item) => [item.id, item.metadata?.thumbnail || item.metadata?.content]));
    const referenceSlots = Array.from({ length: MAX_VIDEO_REFERENCE_SLOTS }, (_, index) => (slots.references || [])[index]);
    const clearSlot = (patch: CanvasVideoSlots) => onVideoSlotsChange(node.id, { ...slots, ...patch });

    return (
        <div className="flex h-full w-full cursor-move flex-col px-3 pb-3 pt-7 text-sm" style={{ color: theme.node.text }}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="shrink-0 text-sm font-semibold">{t("canvas.nodeTypes.videoPrompt")}</div>
                <div className="flex shrink-0 items-center gap-0.5" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                    {videoModeOptions.map((item) => (
                        <button
                            key={item}
                            type="button"
                            className="h-6 cursor-pointer rounded-md px-2 text-[11px] transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={mode === item ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.node.muted }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => onVideoModeChange(node.id, item)}
                        >
                            {t(item === "frames" ? "canvas.videoPrompt.modeFrames" : "canvas.videoPrompt.modeReference")}
                        </button>
                    ))}
                </div>
            </div>
            <div
                className="flex min-h-0 flex-1 flex-col"
                onFocus={() => setEditing(true)}
                onBlur={() => setEditing(false)}
                onMouseDown={(event) => {
                    if (editing) event.stopPropagation();
                }}
                onPointerDown={(event) => {
                    if (editing) event.stopPropagation();
                }}
                onWheel={(event) => event.stopPropagation()}
            >
                <CanvasPromptChipInput
                    value={node.metadata?.prompt || ""}
                    references={references}
                    onChange={(value) => onContentChange(node.id, value)}
                    containerClassName="min-h-0 flex-1"
                    className="thin-scrollbar h-full min-h-0 w-full cursor-text rounded-xl px-2 py-1.5 text-sm leading-6"
                    style={{ background: "transparent", color: theme.node.text }}
                    placeholder={t("canvas.promptPanel.video")}
                />
            </div>
            <div className="mt-2 shrink-0">
                <div className="mb-1 text-xs font-medium" style={{ color: theme.node.muted }}>
                    {t("canvas.videoPrompt.slots")}
                </div>
                {mode === "frames" ? (
                    <div className="grid grid-cols-2 gap-2">
                        <VideoImageSlot
                            label={t("canvas.videoPrompt.firstFrame")}
                            nodeId={node.id}
                            slot="firstFrame"
                            thumbnail={thumbnailById.get(slots.firstFrame || "")}
                            active={dropSlot === "firstFrame"}
                            onClear={() => clearSlot({ firstFrame: undefined })}
                        />
                        <VideoImageSlot
                            label={t("canvas.videoPrompt.lastFrame")}
                            nodeId={node.id}
                            slot="lastFrame"
                            thumbnail={thumbnailById.get(slots.lastFrame || "")}
                            active={dropSlot === "lastFrame"}
                            onClear={() => clearSlot({ lastFrame: undefined })}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2">
                        {referenceSlots.map((id, index) => (
                            <VideoImageSlot
                                key={`reference-${index}`}
                                label={t("canvas.videoPrompt.reference")}
                                nodeId={node.id}
                                slot="reference"
                                thumbnail={id ? thumbnailById.get(id) : undefined}
                                active={dropSlot === "reference"}
                                onClear={() => clearSlot({ references: (slots.references || []).filter((_, itemIndex) => itemIndex !== index) })}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function VideoImageSlot({ label, nodeId, slot, thumbnail, active, onClear }: { label: string; nodeId: string; slot: CanvasVideoSlot; thumbnail?: string; active: boolean; onClear: () => void }) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const highlight = active ? { outline: `2px solid ${selectionBlue}`, outlineOffset: 1 } : undefined;

    return (
        <div className="min-w-0 cursor-default" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <div className="mb-1 truncate text-[11px]" style={{ color: theme.node.muted }}>
                {label}
            </div>
            {thumbnail ? (
                <div className="relative h-14 overflow-hidden rounded-lg border" data-video-slot={slot} data-video-slot-node={nodeId} style={{ borderColor: theme.node.stroke, ...highlight }}>
                    <img src={thumbnail} alt="" draggable={false} className="size-full object-cover" />
                    <button
                        type="button"
                        className="absolute right-0.5 top-0.5 grid size-5 cursor-pointer place-items-center rounded-md"
                        style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                        title={t("canvas.videoPrompt.clearSlot")}
                        aria-label={t("canvas.videoPrompt.clearSlot")}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={onClear}
                    >
                        <X className="size-3" />
                    </button>
                </div>
            ) : (
                <div
                    className="flex h-14 items-center justify-center rounded-lg border border-dashed"
                    data-video-slot={slot}
                    data-video-slot-node={nodeId}
                    style={{ borderColor: theme.node.stroke, color: theme.node.placeholder, ...highlight }}
                    title={t("canvas.videoPrompt.emptySlot")}
                >
                    <Plus className="size-4" />
                </div>
            )}
        </div>
    );
}

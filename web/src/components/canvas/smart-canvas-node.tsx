import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Frame, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { smartCanvasBackground, smartCanvasRatio, smartCanvasResolution, smartCanvasTexts } from "@/lib/canvas/smart-canvas";
import { resolveImageUrl } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

type SmartCanvasNodeContentProps = {
    node: CanvasNodeData;
    boardImages?: CanvasNodeData[];
    onBoardTextsChange?: (nodeId: string, texts: NonNullable<CanvasNodeMetadata["boardTexts"]>) => void;
};

type BoardText = NonNullable<CanvasNodeMetadata["boardTexts"]>[number];

const EMPTY_BOARD_IMAGES: CanvasNodeData[] = [];

export function SmartCanvasNodeContent({ node, boardImages = EMPTY_BOARD_IMAGES, onBoardTextsChange }: SmartCanvasNodeContentProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { t } = useTranslation();
    const urls = useResolvedBoardImageUrls(boardImages);
    const ratio = smartCanvasRatio(node);
    const resolution = smartCanvasResolution(node).toUpperCase();
    const background = smartCanvasBackground(node);
    const gridColor = `${theme.node.stroke}22`;
    const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number; scale: number } | null>(null);
    const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
    const texts = smartCanvasTexts(node);

    const changeTexts = (next: NonNullable<CanvasNodeMetadata["boardTexts"]>) => onBoardTextsChange?.(node.id, next);

    const commitEditing = () => {
        if (!editing) return;
        changeTexts(editing.draft.trim() ? texts.map((text) => (text.id === editing.id ? { ...text, text: editing.draft } : text)) : texts.filter((text) => text.id !== editing.id));
        setEditing(null);
    };

    const startTextDrag = (event: ReactPointerEvent<HTMLDivElement>, text: BoardText) => {
        if (editing) return;
        event.stopPropagation();
        const rect = event.currentTarget.closest("[data-node-id]")?.getBoundingClientRect();
        dragRef.current = { id: text.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: text.x, y: text.y, scale: rect && node.width ? rect.width / node.width : 1 };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const moveTextDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        changeTexts(texts.map((text) => (text.id === drag.id ? { ...text, x: drag.x + (event.clientX - drag.startX) / drag.scale, y: drag.y + (event.clientY - drag.startY) / drag.scale } : text)));
    };

    const endTextDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    };

    return (
        <div
            className="relative h-full w-full overflow-hidden rounded-[inherit]"
            style={{ backgroundColor: background === "transparent" ? theme.node.panel : background, backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`, backgroundSize: "24px 24px" }}
        >
            {boardImages.map((image) => {
                const url = urls[image.id];
                if (!url) return null;
                return (
                    <img
                        key={image.id}
                        src={url}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute select-none object-fill"
                        style={{ left: image.position.x - node.position.x, top: image.position.y - node.position.y, width: image.width, height: image.height }}
                    />
                );
            })}
            {texts.map((text) => (
                <div
                    key={text.id}
                    className="group absolute z-[6] cursor-move"
                    style={{ left: text.x, top: text.y }}
                    onPointerDown={(event) => startTextDrag(event, text)}
                    onPointerMove={moveTextDrag}
                    onPointerUp={endTextDrag}
                    onPointerCancel={endTextDrag}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => {
                        if (editing) return;
                        event.stopPropagation();
                        setEditing({ id: text.id, draft: text.text });
                    }}
                >
                    {editing?.id === text.id ? (
                        <textarea
                            autoFocus
                            value={editing.draft}
                            rows={Math.max(1, editing.draft.split("\n").length)}
                            cols={Math.max(4, ...editing.draft.split("\n").map((line) => line.length))}
                            className="block resize-none border-none bg-transparent p-0 outline-none"
                            style={{ fontSize: text.fontSize, lineHeight: 1.2, color: text.color, whiteSpace: "pre" }}
                            onChange={(event) => setEditing({ id: text.id, draft: event.target.value })}
                            onBlur={commitEditing}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") commitEditing();
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        />
                    ) : (
                        <span className="block" style={{ fontSize: text.fontSize, lineHeight: 1.2, color: text.color, whiteSpace: "pre" }} title={t("canvas.smartCanvas.editTextHint")}>
                            {text.text}
                        </span>
                    )}
                    <button
                        type="button"
                        className="absolute -left-6 top-0 grid size-5 place-items-center rounded opacity-0 transition hover:bg-black/5 group-hover:opacity-100 dark:hover:bg-white/10"
                        style={{ color: theme.node.muted }}
                        aria-label={t("canvas.smartCanvas.deleteText")}
                        title={t("canvas.smartCanvas.deleteText")}
                        onClick={(event) => {
                            event.stopPropagation();
                            changeTexts(texts.filter((item) => item.id !== text.id));
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            ))}
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-dashed" style={{ borderColor: theme.node.stroke }} />
            {boardImages.length ? null : (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ color: theme.node.placeholder }}>
                    <Frame className="size-6 opacity-40" />
                    <span className="text-xs">{t("canvas.smartCanvas.empty")}</span>
                </div>
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium" style={{ background: theme.toolbar.panel, color: theme.node.muted }}>
                <span>{ratio}</span>
                <span>·</span>
                <span>{resolution}</span>
                <span>·</span>
                <span>{t("canvas.smartCanvas.placedCount", { count: boardImages.length })}</span>
            </div>
        </div>
    );
}

function useResolvedBoardImageUrls(images: CanvasNodeData[]) {
    const [urls, setUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        let active = true;
        void Promise.all(images.map(async (image) => [image.id, await resolveImageUrl(image.metadata?.storageKey, image.metadata?.content || "")] as const)).then((entries) => {
            if (active) setUrls(Object.fromEntries(entries));
        });
        return () => {
            active = false;
        };
    }, [images]);

    return urls;
}

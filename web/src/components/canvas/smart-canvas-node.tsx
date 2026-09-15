import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Frame, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { frostedSurfaceClass } from "@/lib/canvas-theme";
import { clampLayerOpacity, resolveBlendMode } from "@/lib/canvas/blend-modes";
import { smartCanvasBackground, smartCanvasRatio, smartCanvasResolution, smartCanvasTexts } from "@/lib/canvas/smart-canvas";
import { resolveImageUrl } from "@/services/image-storage";
import { CanvasNodeType, type CanvasNodeData, type CanvasNodeMetadata } from "@/types/canvas";

type SmartCanvasNodeContentProps = {
    node: CanvasNodeData;
    boardLayers?: CanvasNodeData[];
    boardLayersById?: Map<string, CanvasNodeData[]>;
    onBoardTextsChange?: (nodeId: string, texts: NonNullable<CanvasNodeMetadata["boardTexts"]>) => void;
};

type BoardText = NonNullable<CanvasNodeMetadata["boardTexts"]>[number];

const EMPTY_BOARD_LAYERS: CanvasNodeData[] = [];
const EMPTY_BOARD_LAYERS_BY_ID = new Map<string, CanvasNodeData[]>();

export function SmartCanvasNodeContent({ node, boardLayers = EMPTY_BOARD_LAYERS, boardLayersById = EMPTY_BOARD_LAYERS_BY_ID, onBoardTextsChange }: SmartCanvasNodeContentProps) {
    const theme = useCanvasTheme();
    const { t } = useTranslation();
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
            className={`relative h-full w-full overflow-hidden rounded-[inherit] ${frostedSurfaceClass}`}
            style={{ backgroundColor: background === "transparent" ? theme.toolbar.panel : background, backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`, backgroundSize: "24px 24px", isolation: "isolate" }}
        >
            <BoardLayersView node={node} layers={boardLayers} byId={boardLayersById} visited={new Set([node.id])} />
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
                        className="absolute -left-6 top-0 grid size-5 place-items-center rounded opacity-0 transition hover:bg-black/5 group-hover:opacity-100 dark:hover:bg-card/10"
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
            {boardLayers.length ? null : (
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
                <span>{t("canvas.smartCanvas.placedCount", { count: boardLayers.length })}</span>
            </div>
        </div>
    );
}

function layerBlendStyle(layer: CanvasNodeData): CSSProperties {
    return { mixBlendMode: resolveBlendMode(layer.metadata?.blendMode).css as CSSProperties["mixBlendMode"], opacity: clampLayerOpacity(layer.metadata?.opacity) };
}

function BoardLayersView({ node, layers, byId, visited }: { node: CanvasNodeData; layers: CanvasNodeData[]; byId: Map<string, CanvasNodeData[]>; visited: Set<string> }) {
    const imageLayers = useMemo(() => layers.filter((layer) => layer.type === CanvasNodeType.Image), [layers]);
    const urls = useResolvedBoardImageUrls(imageLayers);
    return (
        <>
            {layers.map((layer) => {
                const left = layer.position.x - node.position.x;
                const top = layer.position.y - node.position.y;
                if (layer.type === CanvasNodeType.SmartCanvas) {
                    if (visited.has(layer.id)) return null;
                    return (
                        <div key={layer.id} className="pointer-events-none absolute overflow-hidden rounded-[inherit]" style={{ left, top, width: layer.width, height: layer.height, isolation: "isolate", ...layerBlendStyle(layer) }}>
                            <BoardLayersView node={layer} layers={byId.get(layer.id) ?? EMPTY_BOARD_LAYERS} byId={byId} visited={new Set(visited).add(layer.id)} />
                        </div>
                    );
                }
                const url = urls[layer.id];
                if (!url) return null;
                return <img key={layer.id} src={url} alt="" draggable={false} className="pointer-events-none absolute select-none object-fill" style={{ left, top, width: layer.width, height: layer.height, ...layerBlendStyle(layer) }} />;
            })}
        </>
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

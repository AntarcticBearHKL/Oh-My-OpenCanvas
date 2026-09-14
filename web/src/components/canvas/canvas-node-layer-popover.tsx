import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { frostedSurfaceClass } from "@/lib/canvas-theme";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export function CanvasNodeLayerPopover({ node, nodes, onMove }: { node: CanvasNodeData; nodes: CanvasNodeData[]; onMove: (direction: "up" | "down") => void }) {
    const theme = useCanvasTheme();
    const { t } = useTranslation();
    const stack = nodes.filter((item) => item.type !== CanvasNodeType.SmartCanvas);
    const stackIndex = stack.findIndex((item) => item.id === node.id);
    if (stackIndex < 0) return null;
    const layer = stack.length - stackIndex;
    const canRaise = moveTargetIndex(stack, stackIndex, 1) !== null;
    const canLower = moveTargetIndex(stack, stackIndex, -1) !== null;

    return (
        <div className="absolute bottom-full left-0 right-0 z-10 pb-2">
            <div
                className={`mx-auto w-[200px] rounded-2xl border p-2.5 text-sm ${frostedSurfaceClass}`}
                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <div className="text-center text-xs font-medium opacity-70">{t("canvas.nodeToolbar.layerCount", { current: layer, total: stack.length })}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        className="flex h-8 items-center justify-center gap-1 rounded-lg text-xs transition hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-white/10 dark:disabled:hover:bg-transparent"
                        aria-label={t("canvas.nodeToolbar.bringForward")}
                        title={t("canvas.nodeToolbar.bringForward")}
                        disabled={!canRaise}
                        onClick={() => onMove("up")}
                    >
                        <ChevronLeft className="size-4" />
                        <span>{t("canvas.nodeToolbar.bringForward")}</span>
                    </button>
                    <button
                        type="button"
                        className="flex h-8 items-center justify-center gap-1 rounded-lg text-xs transition hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-white/10 dark:disabled:hover:bg-transparent"
                        aria-label={t("canvas.nodeToolbar.sendBackward")}
                        title={t("canvas.nodeToolbar.sendBackward")}
                        disabled={!canLower}
                        onClick={() => onMove("down")}
                    >
                        <ChevronRight className="size-4" />
                        <span>{t("canvas.nodeToolbar.sendBackward")}</span>
                    </button>
                </div>
                <div className="mt-2 text-center text-[11px] opacity-45">{t("canvas.nodeToolbar.layerTie")}</div>
            </div>
        </div>
    );
}

function moveTargetIndex(nodes: CanvasNodeData[], index: number, step: 1 | -1) {
    let target = index + step;
    while (target >= 0 && target < nodes.length && (nodes[target].type === CanvasNodeType.Group || nodes[target].type === CanvasNodeType.SmartCanvas)) target += step;
    return target >= 0 && target < nodes.length ? target : null;
}

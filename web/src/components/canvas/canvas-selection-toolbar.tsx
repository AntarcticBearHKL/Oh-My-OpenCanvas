import type { ReactNode } from "react";
import { AlignHorizontalDistributeCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignVerticalDistributeCenter, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, Group, Ungroup } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import type { AlignAxis } from "@/lib/canvas/alignment";
import { nodeBounds } from "@/lib/canvas/canvas-node-geometry";
import type { CanvasNodeData, ViewportTransform } from "@/types/canvas";
import { canvasFloatingBarClass, canvasFloatingBarStyle, CanvasFloatingToolbarAction } from "./canvas-floating-toolbar";

const SELECTION_PAD = 14;

const ALIGN_ACTIONS: { axis: AlignAxis; label: string; icon: ReactNode; needsThree?: boolean }[] = [
    { axis: "left", label: "left", icon: <AlignHorizontalJustifyStart className="size-4" /> },
    { axis: "center-x", label: "centerX", icon: <AlignHorizontalJustifyCenter className="size-4" /> },
    { axis: "right", label: "right", icon: <AlignHorizontalJustifyEnd className="size-4" /> },
    { axis: "top", label: "top", icon: <AlignVerticalJustifyStart className="size-4" /> },
    { axis: "center-y", label: "centerY", icon: <AlignVerticalJustifyCenter className="size-4" /> },
    { axis: "bottom", label: "bottom", icon: <AlignVerticalJustifyEnd className="size-4" /> },
    { axis: "distribute-x", label: "distributeX", icon: <AlignHorizontalDistributeCenter className="size-4" />, needsThree: true },
    { axis: "distribute-y", label: "distributeY", icon: <AlignVerticalDistributeCenter className="size-4" />, needsThree: true },
];

export function CanvasSelectionToolbar({
    nodes,
    viewport,
    showToolbar,
    canGroup,
    canUngroup,
    onGroup,
    onUngroup,
    onAlign,
}: {
    nodes: CanvasNodeData[];
    viewport: ViewportTransform;
    showToolbar: boolean;
    canGroup: boolean;
    canUngroup: boolean;
    onGroup: () => void;
    onUngroup: () => void;
    onAlign: (axis: AlignAxis) => void;
}) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    if (nodes.length < 2) return null;

    const bounds = nodeBounds(nodes);
    const left = viewport.x + bounds.left * viewport.k - SELECTION_PAD;
    const top = viewport.y + bounds.top * viewport.k - SELECTION_PAD;
    const width = (bounds.right - bounds.left) * viewport.k + SELECTION_PAD * 2;
    const height = (bounds.bottom - bounds.top) * viewport.k + SELECTION_PAD * 2;

    return (
        <>
            <svg className="pointer-events-none absolute z-[65] overflow-visible" style={{ left, top, width, height }}>
                <rect
                    x={1}
                    y={1}
                    width={Math.max(width - 2, 0)}
                    height={Math.max(height - 2, 0)}
                    rx={16}
                    ry={16}
                    fill={theme.canvas.selectionFill}
                    stroke={theme.canvas.selectionStroke}
                    strokeOpacity={0.55}
                    strokeWidth={1.5}
                    strokeDasharray="7 5"
                    strokeLinecap="round"
                />
            </svg>
            {showToolbar ? (
                <div
                    className={canvasFloatingBarClass}
                    style={{ ...canvasFloatingBarStyle(theme), left: left + width / 2, top: top - 8 }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    {ALIGN_ACTIONS.filter((action) => nodes.length >= 3 || !action.needsThree).map((action) => (
                        <CanvasFloatingToolbarAction key={action.axis} title={t(`canvas.align.${action.label}`)} icon={action.icon} showLabel={false} onClick={() => onAlign(action.axis)} />
                    ))}
                    {canGroup ? <CanvasFloatingToolbarAction title={t("canvas.nodeToolbar.groupTitle")} label={t("canvas.nodeToolbar.group")} icon={<Group className="size-4" />} onClick={onGroup} /> : null}
                    {canUngroup ? <CanvasFloatingToolbarAction title={t("canvas.nodeToolbar.ungroupTitle")} label={t("canvas.nodeToolbar.ungroup")} icon={<Ungroup className="size-4" />} onClick={onUngroup} /> : null}
                </div>
            ) : null}
        </>
    );
}

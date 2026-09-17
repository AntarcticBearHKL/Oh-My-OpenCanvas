import { useEffect, useState, type ReactNode } from "react";
import { Select, Slider } from "antd";
import { ChevronDown, ChevronUp, Eye, EyeOff, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { CANVAS_BLEND_MODES, clampLayerOpacity, resolveBlendMode } from "@/lib/canvas/blend-modes";
import { resolveImageUrl } from "@/services/image-storage";
import type { CanvasNodeData } from "@/types/canvas";

export type BoardLayerDirection = "forward" | "backward";

type SmartCanvasLayerListProps = {
    layers: CanvasNodeData[];
    onMove: (imageId: string, direction: BoardLayerDirection) => void;
    onToggleHidden: (imageId: string) => void;
    onBlendModeChange: (imageId: string, id: string) => void;
    onOpacityChange: (imageId: string, value: number) => void;
};

const LAYER_ACTION_CLASS = "grid size-6 shrink-0 place-items-center rounded-md opacity-60 transition hover:bg-black/5 hover:opacity-100 disabled:opacity-20 disabled:hover:bg-transparent dark:hover:bg-card/10 dark:disabled:hover:bg-transparent";

export function SmartCanvasLayerList({ layers, onMove, onToggleHidden, onBlendModeChange, onOpacityChange }: SmartCanvasLayerListProps) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const urls = useLayerImageUrls(layers);
    const order = new Map(layers.map((layer, index) => [layer.id, index]));
    const blendModeOptions = CANVAS_BLEND_MODES.map((mode) => ({ value: mode.id, label: t(`canvas.blendModes.${mode.id}`) }));

    if (!layers.length) return <div className="py-3 text-center text-xs opacity-45">{t("canvas.smartCanvas.noLayers")}</div>;

    return (
        <>
            {[...layers].reverse().map((layer) => {
                const index = order.get(layer.id) ?? 0;
                const hidden = layer.metadata?.hidden === true;
                const opacity = Math.round(clampLayerOpacity(layer.metadata?.opacity) * 100);
                return (
                    <div key={layer.id} className="rounded-lg px-1 py-1 transition hover:bg-black/5 dark:hover:bg-card/10">
                        <div className="flex items-center gap-1.5">
                            <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md">
                                {urls[layer.id] ? <img src={urls[layer.id]} alt="" draggable={false} className="h-full w-full object-cover" /> : <ImageIcon className="size-3.5" style={{ color: theme.node.muted }} />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs" style={{ opacity: hidden ? 0.45 : 1 }}>
                                {layer.title || t("canvas.node.untitled")}
                            </span>
                            <LayerAction label={t(hidden ? "canvas.smartCanvas.showLayer" : "canvas.smartCanvas.hideLayer")} onClick={() => onToggleHidden(layer.id)}>
                                {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </LayerAction>
                            <LayerAction label={t("canvas.smartCanvas.moveForward")} disabled={index >= layers.length - 1} onClick={() => onMove(layer.id, "forward")}>
                                <ChevronUp className="size-3.5" />
                            </LayerAction>
                            <LayerAction label={t("canvas.smartCanvas.moveBackward")} disabled={index <= 0} onClick={() => onMove(layer.id, "backward")}>
                                <ChevronDown className="size-3.5" />
                            </LayerAction>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 pl-8">
                            <Select
                                size="small"
                                variant="borderless"
                                className="min-w-0 flex-1"
                                value={resolveBlendMode(layer.metadata?.blendMode).id}
                                options={blendModeOptions}
                                popupMatchSelectWidth={false}
                                styles={{ popup: { root: { zIndex: 1300 } } }}
                                aria-label={t("canvas.smartCanvas.blendMode")}
                                onChange={(value) => onBlendModeChange(layer.id, value)}
                            />
                            <Slider
                                className="!mx-0 !w-16"
                                min={0}
                                max={100}
                                step={1}
                                value={opacity}
                                tooltip={{ formatter: (value) => `${value}%` }}
                                ariaLabelForHandle={t("canvas.smartCanvas.opacity")}
                                onChange={(value) => onOpacityChange(layer.id, value / 100)}
                            />
                            <span className="w-7 shrink-0 text-right text-[11px] tabular-nums" style={{ color: theme.node.muted }}>
                                {opacity}%
                            </span>
                        </div>
                    </div>
                );
            })}
        </>
    );
}

function LayerAction({ label, disabled = false, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" className={LAYER_ACTION_CLASS} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    );
}

function useLayerImageUrls(layers: CanvasNodeData[]) {
    const [urls, setUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        let active = true;
        void Promise.all(layers.map(async (layer) => [layer.id, await resolveImageUrl(layer.metadata?.storageKey, layer.metadata?.content || "")] as const)).then((entries) => {
            if (active) setUrls(Object.fromEntries(entries));
        });
        return () => {
            active = false;
        };
    }, [layers]);

    return urls;
}

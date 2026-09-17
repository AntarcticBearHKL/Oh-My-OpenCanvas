import { ColorPicker, Segmented, Slider } from "antd";
import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { frostedSurfaceClass } from "@/lib/canvas-theme";
import { smartCanvasBackground, smartCanvasBackgroundOpacity } from "@/lib/canvas/smart-canvas";
import type { CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

import { SmartCanvasLayerList, type BoardLayerDirection } from "./smart-canvas-layer-list";

type SmartCanvasLayerPanelProps = {
    node: CanvasNodeData;
    layers: CanvasNodeData[];
    onBoardChange: (patch: Pick<CanvasNodeMetadata, "boardBackground" | "boardBackgroundOpacity">) => void;
    onMove: (imageId: string, direction: BoardLayerDirection) => void;
    onToggleHidden: (imageId: string) => void;
    onBlendModeChange: (imageId: string, id: string) => void;
    onOpacityChange: (imageId: string, value: number) => void;
};

export function SmartCanvasLayerPanel({ node, layers, onBoardChange, onMove, onToggleHidden, onBlendModeChange, onOpacityChange }: SmartCanvasLayerPanelProps) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const background = smartCanvasBackground(node);
    const backgroundOpacity = Math.round(smartCanvasBackgroundOpacity(node) * 100);
    const backgroundOptions = [
        { label: t("canvas.smartCanvas.bgTransparent"), value: "transparent" },
        { label: t("canvas.smartCanvas.bgWhite"), value: "#ffffff" },
        { label: t("canvas.smartCanvas.bgBlack"), value: "#000000" },
    ];

    return (
        <aside data-canvas-no-zoom className={`flex h-full w-[272px] shrink-0 flex-col overflow-hidden border-l ${frostedSurfaceClass}`} style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
            <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: theme.toolbar.border }}>
                <Layers className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                <span className="shrink-0 text-xs font-medium">{t("canvas.smartCanvas.layerPanelTitle")}</span>
                <span className="min-w-0 flex-1 truncate text-right text-xs" style={{ color: theme.node.muted }}>
                    {node.title || t("canvas.node.untitled")}
                </span>
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
                <ImageSettingsTheme theme={theme}>
                    <div className="space-y-2.5 border-b px-3 py-3" style={{ borderColor: theme.toolbar.border }}>
                        <div className="text-xs font-medium" style={{ color: theme.node.muted }}>
                            {t("canvas.smartCanvas.background")}
                        </div>
                        <Segmented size="small" block value={backgroundOptions.some((option) => option.value === background) ? background : undefined} options={backgroundOptions} onChange={(value) => onBoardChange({ boardBackground: value })} />
                        <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: theme.node.muted }}>
                                {t("canvas.smartCanvas.bgCustom")}
                            </span>
                            <ColorPicker size="small" value={background === "transparent" ? "#ffffff" : background} disabledAlpha onChangeComplete={(color) => onBoardChange({ boardBackground: color.toHexString() })} />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="shrink-0 text-xs" style={{ color: theme.node.muted }}>
                                {t("canvas.smartCanvas.backgroundOpacity")}
                            </span>
                            <Slider
                                className="!mx-0 min-w-0 flex-1"
                                min={0}
                                max={100}
                                step={1}
                                value={backgroundOpacity}
                                tooltip={{ formatter: (value) => `${value}%` }}
                                ariaLabelForHandle={t("canvas.smartCanvas.backgroundOpacity")}
                                onChange={(value) => onBoardChange({ boardBackgroundOpacity: value / 100 })}
                            />
                            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums" style={{ color: theme.node.muted }}>
                                {backgroundOpacity}%
                            </span>
                        </div>
                    </div>
                    <div className="px-2 py-2">
                        <div className="px-1 pb-1 text-xs font-medium" style={{ color: theme.node.muted }}>
                            {t("canvas.smartCanvas.layers")}
                        </div>
                        <SmartCanvasLayerList layers={layers} onMove={onMove} onToggleHidden={onToggleHidden} onBlendModeChange={onBlendModeChange} onOpacityChange={onOpacityChange} />
                    </div>
                </ImageSettingsTheme>
            </div>
        </aside>
    );
}

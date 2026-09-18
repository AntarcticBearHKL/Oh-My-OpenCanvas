import { useEffect, useState } from "react";
import { ImageOff, ImagePlus, Loader2, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { DEFAULT_IMAGE_MODIFIER_PARAMS, IMAGE_MODIFIER_PARAMS, formatImageModifierValue, imageModifierFilter, normalizeImageModifierParams } from "@/lib/canvas/image-modifier";
import { resolveImageUrl } from "@/services/image-storage";
import type { CanvasImageModifierParams, CanvasNodeData } from "@/types/canvas";

const MODIFIER_DESIGN_WIDTH = 460;
const MODIFIER_DESIGN_HEIGHT = 644;

export function ImageModifierNodeContent({
    node,
    onParamsChange,
    onEmitChange,
    onGenerate,
    onClearSource,
}: {
    node: CanvasNodeData;
    onParamsChange: (params: CanvasImageModifierParams) => void;
    onEmitChange: (emit: boolean) => void;
    onGenerate: () => Promise<void>;
    onClearSource: () => void;
}) {
    const theme = useCanvasTheme();
    const { t } = useTranslation();
    const source = node.metadata?.modifierSource;
    const params = normalizeImageModifierParams(node.metadata?.modifierParams);
    const emit = Boolean(node.metadata?.modifierEmit);
    const error = node.metadata?.modifierError;
    const [sourceUrl, setSourceUrl] = useState("");
    const [loadFailed, setLoadFailed] = useState(false);
    const [baking, setBaking] = useState(false);

    useEffect(() => {
        let active = true;
        setLoadFailed(false);
        if (!source?.content && !source?.storageKey) {
            setSourceUrl("");
            return;
        }
        void resolveImageUrl(source.storageKey, source.content || "").then((url) => {
            if (!active) return;
            setSourceUrl(url);
            if (!url) setLoadFailed(true);
        });
        return () => {
            active = false;
        };
    }, [source?.content, source?.storageKey]);

    const hasSource = Boolean(source?.content || source?.storageKey);
    const showImage = hasSource && Boolean(sourceUrl) && !loadFailed;
    const layoutScale = Math.min(Math.max(node.width - 4, 1) / MODIFIER_DESIGN_WIDTH, Math.max(node.height - 4, 1) / MODIFIER_DESIGN_HEIGHT);

    return (
        <div className="absolute inset-0 overflow-hidden" onWheel={(event) => event.stopPropagation()}>
            <div
                className="absolute left-1/2 top-1/2 flex flex-col justify-center gap-2 p-4 text-left"
                style={{ width: MODIFIER_DESIGN_WIDTH, height: MODIFIER_DESIGN_HEIGHT, transform: `translate(-50%, -50%) scale(${layoutScale})`, color: theme.node.text }}
            >
                <div className="flex h-7 shrink-0 items-center gap-1">
                    <SlidersHorizontal className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: theme.node.text }}>
                        {t("canvas.nodeTypes.imageModifier")}
                    </span>
                    <button
                        type="button"
                        className="flex h-6 shrink-0 items-center rounded-md px-2 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: theme.node.muted }}
                        onClick={() => onParamsChange(DEFAULT_IMAGE_MODIFIER_PARAMS)}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        {t("canvas.imageModifier.reset")}
                    </button>
                </div>

                <div className="relative flex h-[220px] shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: theme.node.fill }}>
                    {showImage ? (
                        <img src={sourceUrl} alt="" draggable={false} className="h-full w-full object-contain" style={{ filter: imageModifierFilter(params) }} onError={() => setLoadFailed(true)} />
                    ) : (
                        <div className="flex flex-col items-center gap-2 px-4 text-center" style={{ color: theme.node.placeholder }}>
                            {loadFailed ? <ImageOff className="size-6 opacity-40" /> : <ImagePlus className="size-6 opacity-40" />}
                            <span className="text-[11px] leading-5">{loadFailed ? t("canvas.imageModifier.sourceLoadFailed") : hasSource ? t("canvas.imageModifier.rendering") : t("canvas.imageModifier.empty")}</span>
                            {loadFailed ? (
                                <button
                                    type="button"
                                    className="flex h-6 items-center rounded-md px-2 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                                    style={{ color: theme.node.text }}
                                    onClick={onClearSource}
                                    onMouseDown={(event) => event.stopPropagation()}
                                >
                                    {t("canvas.imageModifier.clear")}
                                </button>
                            ) : null}
                        </div>
                    )}
                    {!showImage ? <div className="pointer-events-none absolute inset-0 rounded-xl border border-dashed" style={{ borderColor: theme.node.stroke }} /> : null}
                </div>

                <div className="shrink-0 truncate text-[10px] leading-4" style={{ color: theme.node.muted }} onMouseDown={(event) => event.stopPropagation()}>
                    {emit ? t("canvas.imageModifier.emitHint") : t("canvas.imageModifier.dropHint")}
                </div>

                <button
                    type="button"
                    className="flex h-9 w-full shrink-0 items-center justify-between rounded-lg border px-3 text-[11px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ borderColor: emit ? theme.node.activeStroke : theme.node.stroke, color: emit ? theme.node.activeStroke : theme.node.muted }}
                    title={t("canvas.imageModifier.emitTitle")}
                    onClick={() => onEmitChange(!emit)}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <span className="flex min-w-0 items-center gap-1.5">
                        <Zap className="size-3.5 shrink-0" />
                        <span className="truncate">{emit ? t("canvas.imageModifier.emitOn") : t("canvas.imageModifier.emitOff")}</span>
                    </span>
                    <span className="size-2 shrink-0 rounded-full" style={{ background: emit ? theme.node.activeStroke : theme.node.stroke }} />
                </button>

                <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-2" onMouseDown={(event) => event.stopPropagation()}>
                    {IMAGE_MODIFIER_PARAMS.map((spec) => (
                        <label key={spec.key} className="flex h-9 flex-col justify-between">
                            <span className="flex min-w-0 items-center justify-between gap-1 text-[10px] leading-4" style={{ color: theme.node.muted }}>
                                <span className="truncate">{t(spec.labelKey)}</span>
                                <span className="shrink-0 tabular-nums">{formatImageModifierValue(spec, params[spec.key])}</span>
                            </span>
                            <input
                                type="range"
                                min={spec.min}
                                max={spec.max}
                                step={spec.step}
                                value={params[spec.key]}
                                className="m-0 h-4 w-full"
                                style={{ accentColor: theme.node.activeStroke }}
                                aria-label={t(spec.labelKey)}
                                onChange={(event) => {
                                    const next = { ...params };
                                    next[spec.key] = Number(event.target.value);
                                    onParamsChange(next);
                                }}
                            />
                        </label>
                    ))}
                </div>

                <div className="min-h-4 shrink-0 truncate text-[10px] leading-4" style={{ color: "#f87171" }}>
                    {error}
                </div>

                <button
                    type="button"
                    disabled={!hasSource || baking || loadFailed}
                    onClick={() => {
                        setBaking(true);
                        void onGenerate().finally(() => setBaking(false));
                    }}
                    className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
                    style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                >
                    {baking ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    {baking ? t("canvas.imageModifier.baking") : t("canvas.imageModifier.generate")}
                </button>
            </div>
        </div>
    );
}

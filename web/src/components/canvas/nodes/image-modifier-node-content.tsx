import { useEffect, useState } from "react";
import { ImageOff, ImagePlus, Loader2, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { DEFAULT_IMAGE_MODIFIER_PARAMS, IMAGE_MODIFIER_PARAMS, formatImageModifierValue, imageModifierFilter, normalizeImageModifierParams } from "@/lib/canvas/image-modifier";
import { resolveImageUrl } from "@/services/image-storage";
import type { CanvasImageModifierParams, CanvasNodeData } from "@/types/canvas";

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

    return (
        <div className="flex h-full w-full flex-col gap-2 p-3 text-left">
            <div className="flex items-center gap-1">
                <SlidersHorizontal className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: theme.node.text }}>
                    {t("canvas.nodeTypes.imageModifier")}
                </span>
                <button
                    type="button"
                    className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: emit ? theme.node.activeStroke : theme.node.muted }}
                    title={t("canvas.imageModifier.emitTitle")}
                    onClick={() => onEmitChange(!emit)}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <Zap className="size-3.5" />
                    {emit ? t("canvas.imageModifier.emitOn") : t("canvas.imageModifier.emitOff")}
                </button>
            </div>

            <div className="relative flex min-h-[110px] flex-1 items-center justify-center overflow-hidden rounded-xl" style={{ background: theme.node.fill }}>
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

            <div className="shrink-0 text-[10px] leading-4" style={{ color: theme.node.muted }} onMouseDown={(event) => event.stopPropagation()}>
                {emit ? t("canvas.imageModifier.emitHint") : t("canvas.imageModifier.dropHint")}
            </div>

            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto pr-1" onWheel={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                <div className="grid gap-1.5">
                    {IMAGE_MODIFIER_PARAMS.map((spec) => (
                        <label key={spec.key} className="block">
                            <span className="flex items-center justify-between text-[10px]" style={{ color: theme.node.muted }}>
                                <span>{t(spec.labelKey)}</span>
                                <span className="tabular-nums">{formatImageModifierValue(spec, params[spec.key])}</span>
                            </span>
                            <input
                                type="range"
                                min={spec.min}
                                max={spec.max}
                                step={spec.step}
                                value={params[spec.key]}
                                className="w-full"
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
            </div>

            {error ? <div className="shrink-0 text-[10px] leading-4" style={{ color: "#f87171" }}>{error}</div> : null}

            <div className="flex shrink-0 items-center gap-1.5" onMouseDown={(event) => event.stopPropagation()}>
                <button
                    type="button"
                    disabled={!hasSource || baking || loadFailed}
                    onClick={() => {
                        setBaking(true);
                        void onGenerate().finally(() => setBaking(false));
                    }}
                    className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
                    style={{ background: theme.toolbar.itemHover, color: theme.node.text }}
                >
                    {baking ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    {baking ? t("canvas.imageModifier.baking") : t("canvas.imageModifier.generate")}
                </button>
                <button
                    type="button"
                    className="flex h-8 shrink-0 items-center rounded-lg px-2 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.muted }}
                    onClick={() => onParamsChange(DEFAULT_IMAGE_MODIFIER_PARAMS)}
                >
                    {t("canvas.imageModifier.reset")}
                </button>
            </div>
        </div>
    );
}

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button, Select, Slider } from "antd";
import { ChevronDown, ChevronUp, Eye, EyeOff, Image as ImageIcon, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { CANVAS_BLEND_MODES, clampLayerOpacity, resolveBlendMode } from "@/lib/canvas/blend-modes";
import { frostedSurfaceClass } from "@/lib/canvas-theme";
import { resolveImageUrl } from "@/services/image-storage";
import type { CanvasNodeData } from "@/types/canvas";

type BoardLayerDirection = "forward" | "backward";

type SmartCanvasLayerPopoverProps = {
    images: CanvasNodeData[];
    onMove: (imageId: string, direction: BoardLayerDirection) => void;
    onToggleHidden: (imageId: string) => void;
    onBlendModeChange: (imageId: string, id: string) => void;
    onOpacityChange: (imageId: string, value: number) => void;
};

const LAYER_ACTION_CLASS = "grid size-6 shrink-0 place-items-center rounded-md opacity-60 transition hover:bg-black/5 hover:opacity-100 disabled:opacity-20 disabled:hover:bg-transparent dark:hover:bg-card/10 dark:disabled:hover:bg-transparent";

export function SmartCanvasLayerPopover({ images, onMove, onToggleHidden, onBlendModeChange, onOpacityChange }: SmartCanvasLayerPopoverProps) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!open) return;
        const syncPosition = () => setButtonRect(buttonRef.current?.getBoundingClientRect() || null);
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            if (target instanceof Element && target.closest(".ant-select-dropdown")) return;
            setOpen(false);
        };

        syncPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
        };
    }, [open]);

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0">
                <Button size="small" type="text" className="!h-8 !rounded-full !px-2.5" style={{ color: theme.node.text }} icon={<Layers className="size-3.5" />} onClick={() => setOpen(!open)}>
                    {t("canvas.smartCanvas.layers")}
                </Button>
            </span>
            {open && buttonRect ? <SmartCanvasLayerPortal buttonRect={buttonRect} panelRef={panelRef} images={images} onMove={onMove} onToggleHidden={onToggleHidden} onBlendModeChange={onBlendModeChange} onOpacityChange={onOpacityChange} /> : null}
        </>
    );
}

function SmartCanvasLayerPortal({
    buttonRect,
    panelRef,
    images,
    onMove,
    onToggleHidden,
    onBlendModeChange,
    onOpacityChange,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    images: CanvasNodeData[];
    onMove: (imageId: string, direction: BoardLayerDirection) => void;
    onToggleHidden: (imageId: string) => void;
    onBlendModeChange: (imageId: string, id: string) => void;
    onOpacityChange: (imageId: string, value: number) => void;
}) {
    const { t } = useTranslation();
    const theme = useCanvasTheme();
    const urls = useLayerImageUrls(images);
    const width = 232;
    const gap = 8;
    const margin = 12;
    const height = Math.min(380, Math.max(1, images.length) * 66 + 16);
    const top = buttonRect.bottom + gap + height <= window.innerHeight - margin ? buttonRect.bottom + gap : Math.max(margin, buttonRect.top - gap - height);
    const order = new Map(images.map((image, index) => [image.id, index]));
    const blendModeLabel = (id?: string) => t(`canvas.blendModes.${resolveBlendMode(id).id}`);
    const blendModeOptions = CANVAS_BLEND_MODES.map((mode) => ({ value: mode.id, label: blendModeLabel(mode.id) }));
    const style = {
        position: "fixed",
        zIndex: 1200,
        width,
        left: Math.max(margin, Math.min(window.innerWidth - width - margin, buttonRect.left)),
        top,
        maxHeight: height,
        background: theme.toolbar.panel,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: 16,
        padding: 8,
        overflowY: "auto",
        color: theme.node.text,
    } as const;

    return createPortal(
        <div
            ref={panelRef}
            className={`canvas-smart-canvas-layer-popover thin-scrollbar ${frostedSurfaceClass}`}
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            {images.length ? (
                [...images].reverse().map((image) => {
                    const index = order.get(image.id) ?? 0;
                    const hidden = image.metadata?.hidden === true;
                    const opacity = Math.round(clampLayerOpacity(image.metadata?.opacity) * 100);
                    return (
                        <div key={image.id} className="rounded-lg px-1 py-1 transition hover:bg-black/5 dark:hover:bg-card/10">
                            <div className="flex items-center gap-1.5">
                                <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md">
                                    {urls[image.id] ? <img src={urls[image.id]} alt="" draggable={false} className="h-full w-full object-cover" /> : <ImageIcon className="size-3.5" style={{ color: theme.node.muted }} />}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-xs" style={{ opacity: hidden ? 0.45 : 1 }}>
                                    {image.title || t("canvas.node.untitled")}
                                </span>
                                <LayerAction label={t(hidden ? "canvas.smartCanvas.showLayer" : "canvas.smartCanvas.hideLayer")} onClick={() => onToggleHidden(image.id)}>
                                    {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                </LayerAction>
                                <LayerAction label={t("canvas.smartCanvas.moveForward")} disabled={index >= images.length - 1} onClick={() => onMove(image.id, "forward")}>
                                    <ChevronUp className="size-3.5" />
                                </LayerAction>
                                <LayerAction label={t("canvas.smartCanvas.moveBackward")} disabled={index <= 0} onClick={() => onMove(image.id, "backward")}>
                                    <ChevronDown className="size-3.5" />
                                </LayerAction>
                            </div>
                            <div className="mt-1 flex items-center gap-2 pl-8">
                                <Select
                                    size="small"
                                    variant="borderless"
                                    className="min-w-0 flex-1"
                                    value={resolveBlendMode(image.metadata?.blendMode).id}
                                    options={blendModeOptions}
                                    popupMatchSelectWidth={false}
                                    styles={{ popup: { root: { zIndex: 1300 } } }}
                                    aria-label={t("canvas.smartCanvas.blendMode")}
                                    onChange={(value) => onBlendModeChange(image.id, value)}
                                />
                                <Slider
                                    className="!mx-0 !w-16"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={opacity}
                                    tooltip={{ formatter: (value) => `${value}%` }}
                                    ariaLabelForHandle={t("canvas.smartCanvas.opacity")}
                                    onChange={(value) => onOpacityChange(image.id, value / 100)}
                                />
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="py-3 text-center text-xs opacity-45">{t("canvas.smartCanvas.noLayers")}</div>
            )}
        </div>,
        document.body,
    );
}

function LayerAction({ label, disabled = false, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" className={LAYER_ACTION_CLASS} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    );
}

function useLayerImageUrls(images: CanvasNodeData[]) {
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

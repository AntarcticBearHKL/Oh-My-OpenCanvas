import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "antd";
import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import { frostedSurfaceClass } from "@/lib/canvas-theme";
import type { CanvasNodeData } from "@/types/canvas";

import { SmartCanvasLayerList, type BoardLayerDirection } from "./smart-canvas-layer-list";

type SmartCanvasLayerPopoverProps = {
    images: CanvasNodeData[];
    onMove: (imageId: string, direction: BoardLayerDirection) => void;
    onToggleHidden: (imageId: string) => void;
    onBlendModeChange: (imageId: string, id: string) => void;
    onOpacityChange: (imageId: string, value: number) => void;
};

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
    const theme = useCanvasTheme();
    const width = 244;
    const gap = 8;
    const margin = 12;
    const height = Math.min(380, Math.max(1, images.length) * 66 + 16);
    const top = buttonRect.bottom + gap + height <= window.innerHeight - margin ? buttonRect.bottom + gap : Math.max(margin, buttonRect.top - gap - height);
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
            <SmartCanvasLayerList layers={images} onMove={onMove} onToggleHidden={onToggleHidden} onBlendModeChange={onBlendModeChange} onOpacityChange={onOpacityChange} />
        </div>,
        document.body,
    );
}

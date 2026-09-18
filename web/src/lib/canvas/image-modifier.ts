import { createCanvasContext } from "@/lib/canvas/canvas-2d";
import type { CanvasImageModifierParamKey, CanvasImageModifierParams } from "@/types/canvas";

export type ImageModifierParamUnit = "%" | "deg" | "px";

export type ImageModifierParamSpec = {
    key: CanvasImageModifierParamKey;
    min: number;
    max: number;
    step: number;
    default: number;
    cssFn: string;
    unit: ImageModifierParamUnit;
    labelKey: string;
};

export const IMAGE_MODIFIER_PARAMS: ImageModifierParamSpec[] = [
    { key: "brightness", min: 0, max: 200, step: 1, default: 100, cssFn: "brightness", unit: "%", labelKey: "canvas.imageModifier.brightness" },
    { key: "contrast", min: 0, max: 200, step: 1, default: 100, cssFn: "contrast", unit: "%", labelKey: "canvas.imageModifier.contrast" },
    { key: "saturate", min: 0, max: 200, step: 1, default: 100, cssFn: "saturate", unit: "%", labelKey: "canvas.imageModifier.saturation" },
    { key: "hueRotate", min: -180, max: 180, step: 1, default: 0, cssFn: "hue-rotate", unit: "deg", labelKey: "canvas.imageModifier.hueRotate" },
    { key: "blur", min: 0, max: 20, step: 0.5, default: 0, cssFn: "blur", unit: "px", labelKey: "canvas.imageModifier.blur" },
    { key: "grayscale", min: 0, max: 100, step: 1, default: 0, cssFn: "grayscale", unit: "%", labelKey: "canvas.imageModifier.grayscale" },
    { key: "sepia", min: 0, max: 100, step: 1, default: 0, cssFn: "sepia", unit: "%", labelKey: "canvas.imageModifier.sepia" },
    { key: "invert", min: 0, max: 100, step: 1, default: 0, cssFn: "invert", unit: "%", labelKey: "canvas.imageModifier.invert" },
    { key: "opacity", min: 0, max: 100, step: 1, default: 100, cssFn: "opacity", unit: "%", labelKey: "canvas.imageModifier.opacity" },
];

export const DEFAULT_IMAGE_MODIFIER_PARAMS: CanvasImageModifierParams = IMAGE_MODIFIER_PARAMS.reduce((acc, spec) => ({ ...acc, [spec.key]: spec.default }), {} as CanvasImageModifierParams);

export function normalizeImageModifierParams(params?: Partial<CanvasImageModifierParams> | null): CanvasImageModifierParams {
    return IMAGE_MODIFIER_PARAMS.reduce((acc, spec) => {
        const value = params?.[spec.key];
        acc[spec.key] = typeof value === "number" && Number.isFinite(value) ? Math.min(spec.max, Math.max(spec.min, value)) : spec.default;
        return acc;
    }, { ...DEFAULT_IMAGE_MODIFIER_PARAMS });
}

export function imageModifierFilter(params?: Partial<CanvasImageModifierParams> | null): string {
    const normalized = normalizeImageModifierParams(params);
    return IMAGE_MODIFIER_PARAMS.map((spec) => `${spec.cssFn}(${normalized[spec.key]}${spec.unit})`).join(" ");
}

export function formatImageModifierValue(spec: ImageModifierParamSpec, value: number): string {
    return `${Number.isInteger(value) ? value : value.toFixed(1)}${spec.unit}`;
}

export async function renderImageModifierBlob(sourceUrl: string, params?: Partial<CanvasImageModifierParams> | null): Promise<Blob> {
    const image = await loadImageElement(sourceUrl);
    const { canvas, context } = createCanvasContext(Math.max(1, image.naturalWidth), Math.max(1, image.naturalHeight));
    if (!context) throw new Error("canvas-unavailable");
    context.filter = imageModifierFilter(params);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
    if (!blob) throw new Error("blob-unavailable");
    return blob;
}

function loadImageElement(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("image-load-failed"));
        image.src = src;
    });
}

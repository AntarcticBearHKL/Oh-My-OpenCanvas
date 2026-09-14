import { nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import { readMediaDimensions } from "@/lib/media-size";
import { resolveImageUrl } from "@/services/image-storage";
import { type CanvasNodeData } from "@/types/canvas";

export type SmartCanvasResolution = "1k" | "2k" | "4k";

export const SMART_CANVAS_DEFAULT_RATIO = "16:9";
export const SMART_CANVAS_DEFAULT_RESOLUTION: SmartCanvasResolution = "2k";
export const SMART_CANVAS_BASE_WIDTH = 640;
export const SMART_CANVAS_BASE_HEIGHT = 360;

export type SmartCanvasComposite = {
    dataUrl: string;
    width: number;
    height: number;
};

export function smartCanvasRatio(board: CanvasNodeData) {
    return board.metadata?.boardRatio || SMART_CANVAS_DEFAULT_RATIO;
}

export function smartCanvasResolution(board: CanvasNodeData) {
    return board.metadata?.boardResolution || SMART_CANVAS_DEFAULT_RESOLUTION;
}

export function smartCanvasTargetSize(board: CanvasNodeData) {
    return readMediaDimensions("", smartCanvasResolution(board), smartCanvasRatio(board));
}

export function smartCanvasSizeForRatio(ratio: string) {
    return nodeSizeFromRatio(ratio, SMART_CANVAS_BASE_WIDTH, SMART_CANVAS_BASE_HEIGHT) || { width: SMART_CANVAS_BASE_WIDTH, height: SMART_CANVAS_BASE_HEIGHT };
}

export async function composeSmartCanvas(board: CanvasNodeData, images: CanvasNodeData[], nodes: CanvasNodeData[]): Promise<SmartCanvasComposite> {
    const target = smartCanvasTargetSize(board);
    const width = Math.max(1, target.width);
    const height = Math.max(1, target.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { dataUrl: "", width, height };
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const order = new Map(nodes.map((node, index) => [node.id, index]));
    const ordered = [...images].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const scaleX = width / Math.max(1, board.width);
    const scaleY = height / Math.max(1, board.height);

    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();

    for (const image of ordered) {
        const url = await resolveImageUrl(image.metadata?.storageKey, image.metadata?.content || "");
        if (!url) continue;
        const element = await loadCompositeImage(url);
        if (!element) continue;
        context.drawImage(element, (image.position.x - board.position.x) * scaleX, (image.position.y - board.position.y) * scaleY, image.width * scaleX, image.height * scaleY);
    }

    try {
        return { dataUrl: canvas.toDataURL("image/png"), width, height };
    } catch {
        return { dataUrl: "", width, height };
    }
}

function loadCompositeImage(url: string) {
    return new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

import { createCanvasContext } from "@/lib/canvas/canvas-2d";
import { nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import { readMediaDimensions } from "@/lib/media-size";
import { resolveImageUrl } from "@/services/image-storage";
import { type CanvasNodeData } from "@/types/canvas";

export type SmartCanvasResolution = "1k" | "2k" | "4k";

const SMART_CANVAS_DEFAULT_RATIO = "16:9";
const SMART_CANVAS_DEFAULT_RESOLUTION: SmartCanvasResolution = "2k";
const SMART_CANVAS_DEFAULT_BACKGROUND = "transparent";
const SMART_CANVAS_BASE_WIDTH = 640;
const SMART_CANVAS_BASE_HEIGHT = 360;
export const SMART_CANVAS_DEFAULT_FONT_SIZE = 32;

type SmartCanvasComposite = {
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

export function smartCanvasBackground(board: CanvasNodeData) {
    return board.metadata?.boardBackground || SMART_CANVAS_DEFAULT_BACKGROUND;
}

export function smartCanvasTexts(board: CanvasNodeData) {
    return board.metadata?.boardTexts ?? [];
}

function smartCanvasTargetSize(board: CanvasNodeData) {
    return readMediaDimensions("", smartCanvasResolution(board), smartCanvasRatio(board));
}

export function smartCanvasSizeForRatio(ratio: string) {
    return nodeSizeFromRatio(ratio, SMART_CANVAS_BASE_WIDTH, SMART_CANVAS_BASE_HEIGHT) || { width: SMART_CANVAS_BASE_WIDTH, height: SMART_CANVAS_BASE_HEIGHT };
}

export function arrangeBoardImages(board: CanvasNodeData, images: CanvasNodeData[]) {
    const count = images.length;
    if (!count) return [];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const gap = 16;
    const cellW = (board.width - gap * (cols + 1)) / cols;
    const cellH = (board.height - gap * (rows + 1)) / rows;
    return images.map((image, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const cellX = board.position.x + gap + col * (cellW + gap);
        const cellY = board.position.y + gap + row * (cellH + gap);
        const naturalWidth = image.metadata?.naturalWidth || 0;
        const naturalHeight = image.metadata?.naturalHeight || 0;
        const useNatural = naturalWidth > 0 && naturalHeight > 0;
        const aspectW = useNatural ? naturalWidth : image.width;
        const aspectH = useNatural ? naturalHeight : image.height;
        const scale = aspectW > 0 && aspectH > 0 ? Math.min(cellW / aspectW, cellH / aspectH) : 0;
        const width = Math.round(scale ? Math.max(1, aspectW * scale) : Math.max(1, cellW));
        const height = Math.round(scale ? Math.max(1, aspectH * scale) : Math.max(1, cellH));
        return { id: image.id, position: { x: Math.round(cellX + (cellW - width) / 2), y: Math.round(cellY + (cellH - height) / 2) }, width, height };
    });
}

export async function composeSmartCanvas(board: CanvasNodeData, images: CanvasNodeData[], nodes: CanvasNodeData[]): Promise<SmartCanvasComposite> {
    const target = smartCanvasTargetSize(board);
    const width = Math.max(1, target.width);
    const height = Math.max(1, target.height);
    const { canvas, context } = createCanvasContext(width, height);
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

    const background = smartCanvasBackground(board);
    if (background !== "transparent") {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
    }

    for (const image of ordered) {
        const url = await resolveImageUrl(image.metadata?.storageKey, image.metadata?.content || "");
        if (!url) continue;
        const element = await loadCompositeImage(url);
        if (!element) continue;
        context.drawImage(element, (image.position.x - board.position.x) * scaleX, (image.position.y - board.position.y) * scaleY, image.width * scaleX, image.height * scaleY);
    }

    context.textBaseline = "top";
    for (const text of smartCanvasTexts(board)) {
        context.font = `${text.fontSize * scaleY}px sans-serif`;
        context.fillStyle = text.color;
        text.text.split("\n").forEach((line, index) => context.fillText(line, text.x * scaleX, (text.y + index * text.fontSize * 1.2) * scaleY));
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

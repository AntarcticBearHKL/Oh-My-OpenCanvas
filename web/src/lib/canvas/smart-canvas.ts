import { clampLayerOpacity, resolveBlendMode } from "@/lib/canvas/blend-modes";
import { createCanvasContext } from "@/lib/canvas/canvas-2d";
import { nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import { readMediaDimensions } from "@/lib/media-size";
import { resolveImageUrl } from "@/services/image-storage";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export type SmartCanvasResolution = "1k" | "2k" | "4k";

const SMART_CANVAS_DEFAULT_RATIO = "16:9";
const SMART_CANVAS_DEFAULT_RESOLUTION: SmartCanvasResolution = "2k";
const SMART_CANVAS_DEFAULT_BACKGROUND = "transparent";
const SMART_CANVAS_BASE_WIDTH = 640;
const SMART_CANVAS_BASE_HEIGHT = 360;
export const SMART_CANVAS_DEFAULT_FONT_SIZE = 32;

export type BoardLayoutTemplate = "grid" | "row" | "column" | "feature";

export const BOARD_LAYOUT_TEMPLATES: BoardLayoutTemplate[] = ["grid", "row", "column", "feature"];

type BoardCell = { x: number; y: number; width: number; height: number };

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

export function smartCanvasBackgroundOpacity(board: CanvasNodeData) {
    return clampLayerOpacity(board.metadata?.boardBackgroundOpacity);
}

export function smartCanvasFill(color: string, opacity: number) {
    return opacity >= 1 ? color : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
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

function boardGridCells(x: number, y: number, width: number, height: number, count: number, cols: number): BoardCell[] {
    const gap = 16;
    const rows = Math.ceil(count / cols);
    const cellWidth = (width - gap * (cols + 1)) / cols;
    const cellHeight = (height - gap * (rows + 1)) / rows;
    return Array.from({ length: count }, (_, index) => ({ x: x + gap + (index % cols) * (cellWidth + gap), y: y + gap + Math.floor(index / cols) * (cellHeight + gap), width: cellWidth, height: cellHeight }));
}

function featureBoardCells(board: CanvasNodeData, count: number): BoardCell[] {
    const gap = 16;
    const half = (board.width - gap * 3) / 2;
    const first: BoardCell = { x: board.position.x + gap, y: board.position.y + gap, width: half, height: board.height - gap * 2 };
    const rest = count - 1;
    return rest ? [first, ...boardGridCells(board.position.x + gap * 2 + half, board.position.y, half, board.height, rest, Math.ceil(Math.sqrt(rest)))] : [first];
}

function fitBoardCell(image: CanvasNodeData, cell: BoardCell) {
    const naturalWidth = image.metadata?.naturalWidth || 0;
    const naturalHeight = image.metadata?.naturalHeight || 0;
    const useNatural = naturalWidth > 0 && naturalHeight > 0;
    const aspectW = useNatural ? naturalWidth : image.width;
    const aspectH = useNatural ? naturalHeight : image.height;
    const scale = aspectW > 0 && aspectH > 0 ? Math.min(cell.width / aspectW, cell.height / aspectH) : 0;
    const width = Math.round(scale ? Math.max(1, aspectW * scale) : Math.max(1, cell.width));
    const height = Math.round(scale ? Math.max(1, aspectH * scale) : Math.max(1, cell.height));
    return { id: image.id, position: { x: Math.round(cell.x + (cell.width - width) / 2), y: Math.round(cell.y + (cell.height - height) / 2) }, width, height };
}

export function arrangeBoardImages(board: CanvasNodeData, images: CanvasNodeData[], template: BoardLayoutTemplate = "grid") {
    const count = images.length;
    if (!count) return [];
    const cols = template === "row" ? count : template === "column" ? 1 : Math.ceil(Math.sqrt(count));
    const cells = template === "feature" ? featureBoardCells(board, count) : boardGridCells(board.position.x, board.position.y, board.width, board.height, count, cols);
    return images.map((image, index) => fitBoardCell(image, cells[index]));
}

export function smartCanvasLayers(board: CanvasNodeData) {
    return board.metadata?.boardLayers ?? [];
}

export function boardLayerImageIds(board: CanvasNodeData, images: CanvasNodeData[]) {
    const placed = images.map((image) => image.id);
    const ordered = [...new Set(smartCanvasLayers(board))].filter((id) => placed.includes(id));
    return [...ordered, ...placed.filter((id) => !ordered.includes(id))];
}

export function orderBoardImages(board: CanvasNodeData, images: CanvasNodeData[]) {
    const byId = new Map(images.map((image) => [image.id, image]));
    return boardLayerImageIds(board, images)
        .map((id) => byId.get(id))
        .filter((image): image is CanvasNodeData => Boolean(image && image.metadata?.hidden !== true));
}

export function moveBoardLayer(board: CanvasNodeData, images: CanvasNodeData[], imageId: string, direction: "forward" | "backward") {
    const order = boardLayerImageIds(board, images);
    const index = order.indexOf(imageId);
    const target = index + (direction === "forward" ? 1 : -1);
    if (index < 0 || target < 0 || target >= order.length) return order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

const SMART_CANVAS_COMPOSITE_CACHE_LIMIT = 2;

const compositeCache = new Map<string, SmartCanvasComposite>();

function compositeSignature(board: CanvasNodeData, layers: CanvasNodeData[], nodes: CanvasNodeData[], visited: Set<string>): string {
    const parts = [board.id, board.position.x, board.position.y, board.width, board.height, smartCanvasRatio(board), smartCanvasResolution(board), smartCanvasBackground(board), String(smartCanvasBackgroundOpacity(board)), JSON.stringify(smartCanvasTexts(board))];
    orderBoardImages(board, layers).forEach((layer) => {
        parts.push(`${layer.id}:${layer.position.x},${layer.position.y},${layer.width},${layer.height}:${clampLayerOpacity(layer.metadata?.opacity)}:${resolveBlendMode(layer.metadata?.blendMode).id}:${layer.metadata?.storageKey || layer.metadata?.content || ""}`);
        if (layer.type === CanvasNodeType.SmartCanvas && !visited.has(layer.id)) {
            parts.push(compositeSignature(layer, nodes.filter((node) => node.metadata?.boardId === layer.id), nodes, new Set(visited).add(layer.id)));
        }
    });
    return parts.join("|");
}

function cacheComposite(signature: string, composite: SmartCanvasComposite) {
    if (signature && composite.dataUrl) {
        compositeCache.set(signature, composite);
        if (compositeCache.size > SMART_CANVAS_COMPOSITE_CACHE_LIMIT) {
            const oldest = compositeCache.keys().next().value;
            if (oldest) compositeCache.delete(oldest);
        }
    }
    return composite;
}

export async function composeSmartCanvas(board: CanvasNodeData, layers: CanvasNodeData[], nodes: CanvasNodeData[], visited: Set<string> = new Set()): Promise<SmartCanvasComposite> {
    const signature = visited.size ? "" : compositeSignature(board, layers, nodes, new Set([board.id]));
    const cached = signature ? compositeCache.get(signature) : undefined;
    if (cached) return cached;
    const target = smartCanvasTargetSize(board);
    const width = Math.max(1, target.width);
    const height = Math.max(1, target.height);
    const { canvas, context } = createCanvasContext(width, height);
    if (!context) return { dataUrl: "", width, height };
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const ordered = orderBoardImages(board, layers);
    const scaleX = width / Math.max(1, board.width);
    const scaleY = height / Math.max(1, board.height);
    const nextVisited = new Set(visited);
    nextVisited.add(board.id);

    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();

    const background = smartCanvasBackground(board);
    if (background !== "transparent") {
        context.fillStyle = background;
        context.globalAlpha = smartCanvasBackgroundOpacity(board);
        context.fillRect(0, 0, width, height);
        context.globalAlpha = 1;
    }

    for (const layer of ordered) {
        const x = (layer.position.x - board.position.x) * scaleX;
        const y = (layer.position.y - board.position.y) * scaleY;
        const layerWidth = layer.width * scaleX;
        const layerHeight = layer.height * scaleY;
        const layerAlpha = clampLayerOpacity(layer.metadata?.opacity);
        const layerOperation = resolveBlendMode(layer.metadata?.blendMode).canvas;
        if (layer.type === CanvasNodeType.SmartCanvas) {
            if (nextVisited.has(layer.id)) continue;
            const childLayers = nodes.filter((node) => (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.SmartCanvas) && node.metadata?.boardId === layer.id);
            const nested = await composeSmartCanvas(layer, childLayers, nodes, nextVisited);
            if (!nested.dataUrl) continue;
            const element = await loadCompositeImage(nested.dataUrl);
            if (!element) continue;
            context.save();
            context.globalAlpha = layerAlpha;
            context.globalCompositeOperation = layerOperation;
            context.beginPath();
            context.rect(x, y, layerWidth, layerHeight);
            context.clip();
            context.drawImage(element, x, y, layerWidth, layerHeight);
            context.restore();
            context.globalAlpha = 1;
            context.globalCompositeOperation = "source-over";
            continue;
        }
        const url = await resolveImageUrl(layer.metadata?.storageKey, layer.metadata?.content || "");
        if (!url) continue;
        const element = await loadCompositeImage(url);
        if (!element) continue;
        context.globalAlpha = layerAlpha;
        context.globalCompositeOperation = layerOperation;
        context.drawImage(element, x, y, layerWidth, layerHeight);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
    }

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.textBaseline = "top";
    for (const text of smartCanvasTexts(board)) {
        context.font = `${text.fontSize * scaleY}px sans-serif`;
        context.fillStyle = text.color;
        text.text.split("\n").forEach((line, index) => context.fillText(line, text.x * scaleX, (text.y + index * text.fontSize * 1.2) * scaleY));
    }

    try {
        return cacheComposite(signature, { dataUrl: canvas.toDataURL("image/png"), width, height });
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

import { CanvasNodeType, type CanvasNodeTypeId } from "@/types/canvas";

export type CanvasDropBinding = "collect" | "modify";

type CanvasDropRule = { sourceType: CanvasNodeTypeId; targetType: CanvasNodeTypeId; binding: CanvasDropBinding };

const CANVAS_DROP_RULES: CanvasDropRule[] = [
    { sourceType: CanvasNodeType.Image, targetType: CanvasNodeType.Assets, binding: "collect" },
    { sourceType: CanvasNodeType.Image, targetType: CanvasNodeType.ImageModifier, binding: "modify" },
];

export function resolveCanvasDropBinding(sourceType: CanvasNodeTypeId, targetType: CanvasNodeTypeId): CanvasDropBinding | null {
    return CANVAS_DROP_RULES.find((rule) => rule.sourceType === sourceType && rule.targetType === targetType)?.binding ?? null;
}

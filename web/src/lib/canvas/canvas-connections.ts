import i18n from "@/i18n";
import { CanvasNodeType } from "@/types/canvas";
import type { CanvasConnection, CanvasNodeData } from "@/types/canvas";

const SOURCE_RELATIONS: Record<string, string> = {
    [CanvasNodeType.SmartCanvas]: "composite",
    [CanvasNodeType.Group]: "group",
    [CanvasNodeType.Text]: "prompt",
    [CanvasNodeType.Prompt]: "prompt",
    [CanvasNodeType.Video]: "video-reference",
    [CanvasNodeType.Audio]: "audio-reference",
    [CanvasNodeType.Image]: "reference",
};

export function connectionRelationLabel(connection: CanvasConnection, from: CanvasNodeData, to: CanvasNodeData): string {
    const relation = connection.relation || SOURCE_RELATIONS[from.type] || "linked";
    return i18n.t(`canvas.relations.${relation}`);
}

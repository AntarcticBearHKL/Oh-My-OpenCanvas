import i18n from "@/i18n";
import { CanvasNodeType } from "@/types/canvas";
import type { CanvasConnection, CanvasNodeData } from "@/types/canvas";

const SOURCE_RELATIONS: Record<string, string> = {
    [CanvasNodeType.SmartCanvas]: "composite",
    [CanvasNodeType.Text]: "prompt",
    [CanvasNodeType.Prompt]: "prompt",
    [CanvasNodeType.Video]: "video-reference",
    [CanvasNodeType.Audio]: "audio-reference",
    [CanvasNodeType.Image]: "reference",
};

export function connectionRelationLabel(connection: CanvasConnection, from: CanvasNodeData, to: CanvasNodeData, referenceIndex?: number): string {
    const relation = connection.relation || SOURCE_RELATIONS[from.type] || "linked";
    if (relation === "reference" && to.type === CanvasNodeType.Prompt && referenceIndex !== undefined) return i18n.t("canvas.relations.referenceNumbered", { index: referenceIndex + 1 });
    return i18n.t(`canvas.relations.${relation}`);
}

import i18n from "@/i18n";
import { CanvasNodeType } from "@/types/canvas";
import type { CanvasNodeMetadata } from "@/types/canvas";
import { getNodeSpec as getRegistryNodeSpec } from "@/lib/canvas/node-registry";

type CanvasNodeSpec = {
    width: number;
    height: number;
    title: string;
    metadata?: CanvasNodeMetadata;
};

export const NODE_DEFAULT_SIZE = {
    [CanvasNodeType.Image]: { width: 340, height: 240, get title() { return i18n.t("canvas.nodeTypes.image"); } },
    [CanvasNodeType.Text]: { width: 340, height: 240, get title() { return i18n.t("canvas.nodeTypes.text"); } },
    [CanvasNodeType.Prompt]: { width: 340, height: 240, get title() { return i18n.t("canvas.nodeTypes.prompt"); } },
    [CanvasNodeType.Config]: { width: 340, height: 240, get title() { return i18n.t("canvas.nodeTypes.config"); } },
    [CanvasNodeType.ImageGeneration]: { width: 412, height: 576, get title() { return i18n.t("canvas.nodeTypes.imageGeneration"); } },
    [CanvasNodeType.AudioGeneration]: { width: 560, height: 340, get title() { return i18n.t("canvas.nodeTypes.audioGeneration"); } },
    [CanvasNodeType.MusicGeneration]: { width: 560, height: 340, get title() { return i18n.t("canvas.nodeTypes.musicGeneration"); } },
    [CanvasNodeType.Video]: { width: 420, height: 236, get title() { return i18n.t("canvas.nodeTypes.video"); } },
    [CanvasNodeType.Audio]: { width: 340, height: 120, get title() { return i18n.t("canvas.nodeTypes.audio"); } },
    [CanvasNodeType.SmartCanvas]: { width: 640, height: 360, get title() { return i18n.t("canvas.nodeTypes.smartCanvas"); } },
    [CanvasNodeType.Assets]: { width: 360, height: 320, get title() { return i18n.t("canvas.nodeTypes.assets"); } },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

export const NODE_SPECS = {
    [CanvasNodeType.Image]: {
        width: 340, height: 240, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.Image].title; },
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Text]: {
        width: 340, height: 240, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.Text].title; },
        metadata: { content: "", status: "idle", fontSize: 14 },
    },
    [CanvasNodeType.Prompt]: {
        width: 340, height: 240, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.Prompt].title; },
        metadata: { prompt: "", status: "idle" },
    },
    [CanvasNodeType.Config]: {
        width: 340, height: 240, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.Config].title; },
        metadata: { content: "", status: "idle", generationMode: "image" },
    },
    [CanvasNodeType.ImageGeneration]: {
            width: 412, height: 576, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.ImageGeneration].title; },
        metadata: { status: "idle", generationMode: "image" },
    },
    [CanvasNodeType.AudioGeneration]: {
        width: 560, height: 340, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.AudioGeneration].title; },
        metadata: { status: "idle", generationMode: "audio" },
    },
    [CanvasNodeType.MusicGeneration]: {
        width: 560, height: 340, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.MusicGeneration].title; },
        metadata: { status: "idle", generationMode: "audio", model: "google/lyria-3-pro-preview", audioFormat: "mp3" },
    },
    [CanvasNodeType.Video]: {
        width: 420, height: 236, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.Video].title; },
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Audio]: {
        width: 340, height: 120, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.Audio].title; },
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.SmartCanvas]: {
        width: 640, height: 360, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.SmartCanvas].title; },
        metadata: { status: "idle", boardRatio: "16:9", boardResolution: "2k" },
    },
    [CanvasNodeType.Assets]: {
        width: 360, height: 320, get title() { return NODE_DEFAULT_SIZE[CanvasNodeType.Assets].title; },
        metadata: {},
    },
} satisfies Record<CanvasNodeType, CanvasNodeSpec>;

// Return built-in specs directly and resolve plugin types from the registry.
export function getNodeSpec(type: string) {
    if ((Object.values(CanvasNodeType) as string[]).includes(type)) return NODE_SPECS[type as CanvasNodeType];
    const spec = getRegistryNodeSpec(type);
    return { width: spec.width, height: spec.height, title: spec.title, metadata: spec.metadata };
}

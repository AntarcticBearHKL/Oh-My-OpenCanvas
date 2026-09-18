export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Prompt = "prompt",
    MusicPrompt = "music-prompt",
    SpeechPrompt = "speech-prompt",
    Config = "config",
    ImageGeneration = "image-generation",
    SpeechGeneration = "speech-generation",
    MusicGeneration = "music-generation",
    Video = "video",
    Audio = "audio",
    SmartCanvas = "smart-canvas",
    Assets = "assets",
    Recording = "recording",
    ImageModifier = "image-modifier",
}

// Node types are open strings: built-ins use CanvasNodeType and plugins use "<pluginId>:<name>".
export type CanvasNodeTypeId = CanvasNodeType | (string & {});

type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";

export type CanvasNodeImage = {
    id: string;
    status: CanvasNodeStatus;
    errorDetails?: string;
    content: string;
    storageKey?: string;
    thumbnail?: string;
    thumbnailKey?: string;
    naturalWidth: number;
    naturalHeight: number;
    bytes: number;
    mimeType: string;
};

export type CanvasNodeText = {
    id: string;
    status: CanvasNodeStatus;
    errorDetails?: string;
    content: string;
};

export type CanvasImageModifierParams = {
    brightness: number;
    contrast: number;
    saturate: number;
    hueRotate: number;
    blur: number;
    grayscale: number;
    sepia: number;
    invert: number;
    opacity: number;
};

export type CanvasImageModifierParamKey = keyof CanvasImageModifierParams;

export type CanvasImageModifierSource = {
    content: string;
    storageKey?: string;
    thumbnail?: string;
    thumbnailKey?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    bytes?: number;
    mimeType?: string;
};

export type CanvasNodeMetadata = {
    content?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    fontWeight?: "normal" | "bold";
    italic?: boolean;
    textAlign?: "left" | "center" | "right";
    textColor?: string;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    reasoningEffort?: "auto" | "low" | "medium" | "high" | "xhigh";
    size?: string;
    quality?: string;
    background?: string;
    count?: number;
    textCount?: number;
    texts?: CanvasNodeText[];
    primaryTextId?: string;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    videoMode?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    images?: CanvasNodeImage[];
    primaryImageId?: string;
    storageKey?: string;
    thumbnail?: string;
    thumbnailKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    videoTaskId?: string;
    videoTaskProvider?: "openai" | "plugin";
    boardRatio?: string; // Smart Canvas board aspect ratio, e.g. "16:9"; defaults to "16:9".
    boardResolution?: "1k" | "2k" | "4k"; // Smart Canvas composite resolution tier; defaults to "2k".
    boardId?: string; // Set on an IMAGE node to mark it as placed on that Smart Canvas board.
    boardBackground?: string; // Smart Canvas board background colour as a CSS colour string; defaults to "transparent".
    boardBackgroundOpacity?: number; // Smart Canvas board background opacity in 0..1; defaults to 1.
    boardTexts?: { id: string; text: string; x: number; y: number; fontSize: number; color: string }[]; // Smart Canvas text annotations drawn above placed images; x/y are board-local top-left coordinates and fontSize uses board units.
    boardLayers?: string[];
    blendMode?: string;
    opacity?: number;
    interactive?: boolean; // Plugin node interaction/move state; see CanvasNodeDefinition.interactionToggle.
    locked?: boolean;
    hidden?: boolean;
    assetFolderName?: string;
    outputFolderName?: string;
    modifierSource?: CanvasImageModifierSource;
    modifierParams?: CanvasImageModifierParams;
    modifierEmit?: boolean;
    modifierError?: string;
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    relation?: string; // Relationship label key under canvas.relations; when unset the label is derived from the node types.
};

type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool" | "error";
    title?: string;
    text: string;
    meta?: string;
    detail?: unknown;
    references?: CanvasAssistantReference[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

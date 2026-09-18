import { clampVideoSeconds, parseVideoResolution, VIDEO_SECONDS_MAX, VIDEO_SECONDS_MIN } from "@/lib/media-size";

export type VideoMode = "frames" | "reference";

export function normalizeVideoMode(value: string | undefined): VideoMode {
    return value === "reference" ? "reference" : "frames";
}

export type VideoModelCapability = {
    resolutions: string[];
    durationMin: number;
    durationMax: number;
    aspectRatios: string[];
    supportsSize: boolean;
    supportsAudio: boolean;
    supportsWatermark: boolean;
    supportsSeed: boolean;
    frameImages: Array<"first_frame" | "last_frame">;
    inputReferences: boolean;
};

export type VideoModelOption = { value: string; label: string; capability: VideoModelCapability };

export const openRouterVideoModels: VideoModelOption[] = [
    {
        value: "minimax/hailuo-3-max",
        label: "MiniMax: H3 Max",
        capability: {
            resolutions: ["480p", "768p"],
            durationMin: 5,
            durationMax: 15,
            aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
            supportsSize: false,
            supportsAudio: false,
            supportsWatermark: false,
            supportsSeed: false,
            frameImages: ["first_frame", "last_frame"],
            inputReferences: true,
        },
    },
];

/** Permissive fallback that keeps plugin and legacy video models behaving as before. */
const fallbackVideoModelCapability: VideoModelCapability = {
    resolutions: [],
    durationMin: VIDEO_SECONDS_MIN,
    durationMax: VIDEO_SECONDS_MAX,
    aspectRatios: [],
    supportsSize: true,
    supportsAudio: true,
    supportsWatermark: true,
    supportsSeed: true,
    frameImages: ["first_frame", "last_frame"],
    inputReferences: true,
};

export function openRouterVideoModelOf(value: string | undefined) {
    return openRouterVideoModels.find((model) => model.value === value);
}

export function isOpenRouterVideoModel(value: string | undefined): value is string {
    return openRouterVideoModels.some((model) => model.value === value);
}

export function openRouterVideoModelCapability(value: string | undefined): VideoModelCapability | undefined {
    return openRouterVideoModelOf(value)?.capability;
}

export function videoModelCapability(value: string | undefined): VideoModelCapability {
    return openRouterVideoModelCapability(value) || fallbackVideoModelCapability;
}

/** Map a stored resolution to one the capability accepts, falling back to the closest supported value. */
export function supportedVideoResolution(value: string | undefined, capability: VideoModelCapability): string | undefined {
    if (!capability.resolutions.length) return undefined;
    const current = Number(parseVideoResolution(value));
    const exact = capability.resolutions.find((item) => Number(parseVideoResolution(item)) === current);
    if (exact) return exact;
    return capability.resolutions.reduce((best, item) => (Math.abs(Number(parseVideoResolution(item)) - current) < Math.abs(Number(parseVideoResolution(best)) - current) ? item : best), capability.resolutions[0]);
}

export function videoModelDuration(value: string | undefined, capability: VideoModelCapability) {
    return Number(clampVideoSeconds(value || "6", capability.durationMin, capability.durationMax));
}

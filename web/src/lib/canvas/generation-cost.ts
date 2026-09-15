import { decodeChannelModel } from "@/stores/use-config-store";

export type GenerationCostUnit = "image" | "video-second" | "call";

export type ModelPrice = { unit: GenerationCostUnit; usd: number };

export const MODEL_PRICES: Record<string, ModelPrice> = {
    "gpt-image-1": { unit: "image", usd: 0.04 },
    "dall-e-3": { unit: "image", usd: 0.04 },
    "gpt-4o": { unit: "call", usd: 0.005 },
    "gpt-4o-mini": { unit: "call", usd: 0.0006 },
    sora: { unit: "video-second", usd: 0.1 },
    "tts-1": { unit: "call", usd: 0.015 },
};

export const GENERATION_COST_RECORD_LIMIT = 200;

export function priceModelId(model: string): string {
    return (decodeChannelModel(model)?.model || model).trim().toLowerCase();
}

export function modelPrice(model: string): ModelPrice | undefined {
    return MODEL_PRICES[priceModelId(model)];
}

export function estimateGenerationCost(model: string, unit: GenerationCostUnit, quantity: number): { usd: number; priced: boolean; reason?: "unpriced-model" | "unpriced-unit" } {
    const price = modelPrice(model);
    if (!price) return { usd: 0, priced: false, reason: "unpriced-model" };
    if (price.unit !== unit || !Number.isFinite(quantity) || quantity <= 0) return { usd: 0, priced: false, reason: "unpriced-unit" };
    return { usd: Number((price.usd * quantity).toFixed(6)), priced: true };
}

export function formatUsd(usd: number): string {
    return `$${usd.toFixed(2)}`;
}

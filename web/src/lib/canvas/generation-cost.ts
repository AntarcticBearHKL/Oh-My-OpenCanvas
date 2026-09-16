import { decodeChannelModel } from "@/stores/use-config-store";

export type GenerationCostUnit = "image" | "video-second" | "call";

export type GenerationCostSource = "api" | "lookup" | "estimate";

export type GenerationCost = { usd: number; priced: boolean; source: GenerationCostSource; reason?: "unpriced-model" | "unpriced-unit" };

export type ModelPrice = { unit: GenerationCostUnit; usd: number };

export type ModelTokenPrice = { inputText: number; inputImage: number; outputImage: number };

export const MODEL_PRICES: Record<string, ModelPrice> = {
    "gpt-image-1": { unit: "image", usd: 0.04 },
    "dall-e-3": { unit: "image", usd: 0.04 },
    "gpt-4o": { unit: "call", usd: 0.005 },
    "gpt-4o-mini": { unit: "call", usd: 0.0006 },
    sora: { unit: "video-second", usd: 0.1 },
    "tts-1": { unit: "call", usd: 0.015 },
};

export const MODEL_TOKEN_PRICES: Record<string, ModelTokenPrice> = {
    "openai/gpt-image-2.5-sunburst": { inputText: 0.000005, inputImage: 0.000008, outputImage: 0.00003 },
};

export const GENERATION_COST_RECORD_LIMIT = 200;

export function priceModelId(model: string): string {
    return (decodeChannelModel(model)?.model || model).trim().toLowerCase();
}

export function modelPrice(model: string): ModelPrice | undefined {
    return MODEL_PRICES[priceModelId(model)];
}

export function estimateGenerationCost(model: string, unit: GenerationCostUnit, quantity: number): GenerationCost {
    const price = modelPrice(model);
    if (!price) return { usd: 0, priced: false, source: "estimate", reason: "unpriced-model" };
    if (price.unit !== unit || !Number.isFinite(quantity) || quantity <= 0) return { usd: 0, priced: false, source: "estimate", reason: "unpriced-unit" };
    return { usd: Number((price.usd * quantity).toFixed(6)), priced: true, source: "estimate" };
}

export function estimateTokenCost(model: string, usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number; hasReference?: boolean }): GenerationCost | null {
    const price = MODEL_TOKEN_PRICES[priceModelId(model)];
    const completionTokens = Math.max(0, Number(usage.completionTokens) || 0);
    const promptTokens = Math.max(0, Number(usage.promptTokens) || (Number(usage.totalTokens) || 0) - completionTokens);
    if (!price || (!promptTokens && !completionTokens)) return null;
    const inputRate = usage.hasReference ? price.inputImage : price.inputText;
    return { usd: Number((promptTokens * inputRate + completionTokens * price.outputImage).toFixed(6)), priced: true, source: "estimate" };
}

export function formatUsd(usd: number): string {
    return `$${usd.toFixed(2)}`;
}

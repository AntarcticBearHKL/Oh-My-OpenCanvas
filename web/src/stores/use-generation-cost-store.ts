import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { nanoid } from "nanoid";
import { localForageStorage } from "@/lib/localforage-storage";
import { estimateGenerationCost, GENERATION_COST_RECORD_LIMIT, type GenerationCostUnit } from "@/lib/canvas/generation-cost";

export type GenerationCostRecord = { id: string; nodeId: string; model: string; unit: GenerationCostUnit; quantity: number; usd: number; priced: boolean; reason?: string; at: number };

export type GenerationCostInput = { nodeId: string; model: string; unit: GenerationCostUnit; quantity: number };

type GenerationCostStore = {
    records: GenerationCostRecord[];
    record: (input: GenerationCostInput) => void;
    clear: () => void;
};

const GENERATION_COST_STORE_KEY = "infinite-canvas:generation_cost_store";

const costStorage: PersistStorage<GenerationCostStore> = {
    getItem: async (name) => {
        const value = await localForageStorage.getItem(name);
        return value ? (JSON.parse(value) as StorageValue<GenerationCostStore>) : null;
    },
    setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const useGenerationCostStore = create<GenerationCostStore>()(
    persist(
        (set) => ({
            records: [],
            record: (input) => {
                const estimate = estimateGenerationCost(input.model, input.unit, input.quantity);
                const entry: GenerationCostRecord = { id: nanoid(), nodeId: input.nodeId, model: input.model, unit: input.unit, quantity: input.quantity, usd: estimate.usd, priced: estimate.priced, reason: estimate.reason, at: Date.now() };
                set((state) => ({ records: [entry, ...state.records].slice(0, GENERATION_COST_RECORD_LIMIT) }));
            },
            clear: () => set({ records: [] }),
        }),
        {
            name: GENERATION_COST_STORE_KEY,
            storage: costStorage,
            partialize: (state) => ({ records: state.records }) as StorageValue<GenerationCostStore>["state"],
        },
    ),
);

export function recordGenerationCost(input: GenerationCostInput) {
    useGenerationCostStore.getState().record(input);
}

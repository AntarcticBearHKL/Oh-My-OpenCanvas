export type GenerationMatrix = { sizes?: string[]; counts?: number[]; prompts?: string[] };

export type GenerationMatrixVariant = { size?: string; count?: number; prompt?: string };

function matrixStrings(values: string[] | undefined) {
    return (values || []).map((value) => value.trim()).filter((value) => value.length > 0);
}

function matrixCounts(values: number[] | undefined) {
    return (values || []).filter((value) => Number.isFinite(value) && value > 0);
}

export function buildMatrixVariants(matrix: GenerationMatrix | undefined): GenerationMatrixVariant[] {
    if (!matrix) return [];
    const prompts = matrixStrings(matrix.prompts);
    const counts = matrixCounts(matrix.counts);
    const sizes = matrixStrings(matrix.sizes);
    if (!prompts.length && !counts.length && !sizes.length) return [];
    const promptValues: Array<string | undefined> = prompts.length ? prompts : [undefined];
    const countValues: Array<number | undefined> = counts.length ? counts : [undefined];
    const sizeValues: Array<string | undefined> = sizes.length ? sizes : [undefined];
    return promptValues.flatMap((prompt) => countValues.flatMap((count) => sizeValues.map((size) => ({ size, count, prompt }))));
}

export function describeMatrixVariant(variant: GenerationMatrixVariant): string {
    return [variant.size, variant.count === undefined ? undefined : `x${variant.count}`, variant.prompt].filter((part): part is string => Boolean(part)).join(" · ");
}

export type PromptVariable = { name: string; value: string };

const VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g;

export function parsePromptVariables(text: string): string[] {
    const names: string[] = [];
    if (!text) return names;
    for (const match of text.matchAll(VARIABLE_PATTERN)) {
        const name = match[1].trim();
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

export function applyPromptVariables(text: string, variables?: PromptVariable[]): string {
    if (!text || !variables?.length) return text;
    const values = new Map<string, string>();
    for (const variable of variables) {
        const name = variable.name.trim();
        if (name && !values.has(name)) values.set(name, variable.value);
    }
    if (!values.size) return text;
    return text.replace(VARIABLE_PATTERN, (token, inner: string) => {
        const value = values.get(inner.trim());
        return value === undefined ? token : value;
    });
}

export function resolvePromptVariableList(prompt: string, variables?: PromptVariable[]): PromptVariable[] {
    const existing = variables || [];
    const detected = parsePromptVariables(prompt);
    const rows = detected.map((name) => ({ name, value: existing.find((variable) => variable.name.trim() === name)?.value ?? "" }));
    return [...rows, ...existing.filter((variable) => variable.name.trim() && !detected.includes(variable.name.trim()))];
}

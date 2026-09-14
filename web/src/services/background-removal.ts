import { removeBackground } from "@imgly/background-removal";

export function removeImageBackground(source: string | Blob, onProgress?: (key: string, current: number, total: number) => void) {
    return removeBackground(source, { model: "isnet_quint8", progress: onProgress });
}

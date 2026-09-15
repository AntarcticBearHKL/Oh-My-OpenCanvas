import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/types/canvas";

export function resolveLatestUpstream(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], updatedAt?: Record<string, number>): CanvasNodeData | null {
    const upstream = connections
        .filter((connection) => connection.toNodeId === nodeId)
        .map((connection) => nodes.find((node) => node.id === connection.fromNodeId))
        .filter((node): node is CanvasNodeData => Boolean(node));
    let latest: CanvasNodeData | null = null;
    let latestStamp = Number.NEGATIVE_INFINITY;
    upstream.forEach((node) => {
        const stamp = updatedAt?.[node.id];
        if (typeof stamp === "number" && stamp >= latestStamp) {
            latestStamp = stamp;
            latest = node;
        }
    });
    return latest || upstream[upstream.length - 1] || null;
}

export function pickDefaultOutput(nodes: CanvasNodeData[]): CanvasNodeData | null {
    return nodes.find((node) => node.type === CanvasNodeType.Output) || null;
}

export function outputNodesConflict(nodes: CanvasNodeData[]): boolean {
    return nodes.filter((node) => node.type === CanvasNodeType.Output).length > 1;
}

export function describeOutputSource(node: CanvasNodeData | null): string {
    if (!node) return "";
    return node.title?.trim() || "Untitled";
}

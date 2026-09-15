import type { CanvasConnection, CanvasNodeData } from "@/types/canvas";

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

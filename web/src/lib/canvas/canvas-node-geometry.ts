import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeTypeId, type ConnectionHandle } from "@/types/canvas";

export function nodeBounds(nodes: CanvasNodeData[]) {
    return nodes.reduce(
        (acc, node) => ({
            left: Math.min(acc.left, node.position.x),
            top: Math.min(acc.top, node.position.y),
            right: Math.max(acc.right, node.position.x + node.width),
            bottom: Math.max(acc.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

export const CANVAS_GRID_SIZE = 16;

export function snapDragToGuides(initialNodes: { id: string; x: number; y: number }[], nodes: CanvasNodeData[], dx: number, dy: number, threshold: number, gridSize = 0) {
    const movedIds = new Set(initialNodes.map((item) => item.id));
    const moved = nodes.filter((node) => movedIds.has(node.id));
    if (!moved.length) return { dx, dy, guides: { x: [], y: [] } };
    const bounds = moved.reduce(
        (acc, node) => {
            const start = initialNodes.find((item) => item.id === node.id)!;
            return {
                left: Math.min(acc.left, start.x + dx),
                top: Math.min(acc.top, start.y + dy),
                right: Math.max(acc.right, start.x + dx + node.width),
                bottom: Math.max(acc.bottom, start.y + dy + node.height),
            };
        },
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
    const draggedX = [bounds.left, (bounds.left + bounds.right) / 2, bounds.right];
    const draggedY = [bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom];
    let snapX: { diff: number; line: number } | null = null;
    let snapY: { diff: number; line: number } | null = null;
    for (const node of nodes) {
        if (movedIds.has(node.id) || isContainerNode(node)) continue;
        for (const line of [node.position.x, node.position.x + node.width / 2, node.position.x + node.width]) {
            for (const value of draggedX) {
                const diff = line - value;
                if (Math.abs(diff) <= threshold && (!snapX || Math.abs(diff) < Math.abs(snapX.diff))) snapX = { diff, line };
            }
        }
        for (const line of [node.position.y, node.position.y + node.height / 2, node.position.y + node.height]) {
            for (const value of draggedY) {
                const diff = line - value;
                if (Math.abs(diff) <= threshold && (!snapY || Math.abs(diff) < Math.abs(snapY.diff))) snapY = { diff, line };
            }
        }
    }
    const applyAxis = (delta: number, edge: number, snap: { diff: number } | null) => (snap ? delta + snap.diff : gridSize > 0 ? delta + (Math.round(edge / gridSize) * gridSize - edge) : delta);
    return { dx: applyAxis(dx, bounds.left, snapX), dy: applyAxis(dy, bounds.top, snapY), guides: { x: snapX ? [snapX.line] : [], y: snapY ? [snapY.line] : [] } };
}

export function nodeCenterInside(node: CanvasNodeData, rect: CanvasNodeData) {
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;
    return centerX >= rect.position.x && centerX <= rect.position.x + rect.width && centerY >= rect.position.y && centerY <= rect.position.y + rect.height;
}

export function isContainerNode(node: CanvasNodeData) {
    return node.type === CanvasNodeType.Group || node.type === CanvasNodeType.Frame;
}

export function findGroupDropTarget(movedIds: Set<string>, nodes: CanvasNodeData[]) {
    if (nodes.some((node) => movedIds.has(node.id) && isContainerNode(node))) return null;
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && !isContainerNode(node));
    if (!movingNodes.length) return null;
    return (
        [...nodes].reverse().find((group) => {
            if (!isContainerNode(group) || movedIds.has(group.id)) return false;
            return movingNodes.some((node) => {
                const centerX = node.position.x + node.width / 2;
                const centerY = node.position.y + node.height / 2;
                return centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height;
            });
        }) || null
    );
}

export function findBoardDropTarget(movedIds: Set<string>, nodes: CanvasNodeData[]) {
    const movingImages = nodes.filter((node) => movedIds.has(node.id) && node.type === CanvasNodeType.Image);
    if (!movingImages.length) return null;
    return (
        [...nodes].reverse().find((board) => {
            if (board.type !== CanvasNodeType.SmartCanvas || movedIds.has(board.id)) return false;
            return movingImages.some((node) => nodeCenterInside(node, board));
        }) || null
    );
}

export function snapNodesIntoGroup(movedIds: Set<string>, nodes: CanvasNodeData[], group: CanvasNodeData) {
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && !isContainerNode(node));
    if (!movingNodes.length) return nodes;
    const pad = 24;
    const bounds = nodeBounds(movingNodes);
    const left = group.position.x + pad;
    const top = group.position.y + pad;
    const right = group.position.x + group.width - pad;
    const bottom = group.position.y + group.height - pad;
    const dx = bounds.right - bounds.left > right - left ? left - bounds.left : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.bottom - bounds.top > bottom - top ? top - bounds.top : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    return nodes.map((node) => {
        if (!movedIds.has(node.id) || isContainerNode(node)) return node;
        return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy }, metadata: { ...node.metadata, groupId: group.id } };
    });
}

const GROUP_WRAP_PADDING = 24;
const GROUP_WRAP_TOP_PADDING = 52;

function selectedGroupIds(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    return new Set(nodes.filter((node) => selectedIds.has(node.id) && node.type === CanvasNodeType.Group).map((node) => node.id));
}

export function collectGroupMemberNodes(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    const groups = selectedGroupIds(selectedIds, nodes);
    return nodes.filter((node) => node.type !== CanvasNodeType.Group && (selectedIds.has(node.id) || (node.metadata?.groupId != null && groups.has(node.metadata.groupId))));
}

export function getGroupWrapRect(members: CanvasNodeData[]) {
    const bounds = nodeBounds(members);
    return {
        x: bounds.left - GROUP_WRAP_PADDING,
        y: bounds.top - GROUP_WRAP_TOP_PADDING,
        width: bounds.right - bounds.left + GROUP_WRAP_PADDING * 2,
        height: bounds.bottom - bounds.top + GROUP_WRAP_TOP_PADDING + GROUP_WRAP_PADDING,
    };
}

export function canGroupSelectedNodes(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    const members = collectGroupMemberNodes(selectedIds, nodes);
    if (members.length < 2) return false;
    const groupId = members[0].metadata?.groupId;
    return !groupId || members.some((node) => node.metadata?.groupId !== groupId);
}

export function canUngroupSelectedNodes(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    return nodes.some((node) => selectedIds.has(node.id) && (node.type === CanvasNodeType.Group || Boolean(node.metadata?.groupId)));
}

function emptyGroupIds(nodes: CanvasNodeData[], keepId?: string) {
    const used = new Set(nodes.flatMap((node) => (node.type !== CanvasNodeType.Group && node.metadata?.groupId ? [node.metadata.groupId] : [])));
    return new Set(nodes.filter((node) => node.type === CanvasNodeType.Group && node.id !== keepId && !used.has(node.id)).map((node) => node.id));
}

function withoutRemoved(nodes: CanvasNodeData[], connections: CanvasConnection[], removedIds: Set<string>) {
    return {
        nodes: nodes.filter((node) => !removedIds.has(node.id)),
        connections: connections.filter((connection) => !removedIds.has(connection.fromNodeId) && !removedIds.has(connection.toNodeId)),
    };
}

export function applyGroupSelection(selectedIds: Set<string>, nodes: CanvasNodeData[], connections: CanvasConnection[], group: CanvasNodeData) {
    const members = collectGroupMemberNodes(selectedIds, nodes);
    if (members.length < 2) return null;
    const memberIds = new Set(members.map((node) => node.id));
    const flattenedGroupIds = selectedGroupIds(selectedIds, nodes);
    const updated = nodes.filter((node) => !flattenedGroupIds.has(node.id)).map((node) => (memberIds.has(node.id) ? { ...node, metadata: { ...node.metadata, groupId: group.id } } : node));
    const insertAt = updated.findIndex((node) => memberIds.has(node.id));
    const withGroup = insertAt < 0 ? [...updated, group] : [...updated.slice(0, insertAt), group, ...updated.slice(insertAt)];
    const next = withoutRemoved(withGroup, connections, new Set([...flattenedGroupIds, ...emptyGroupIds(withGroup, group.id)]));
    return { ...next, selectedIds: [group.id] };
}

export function applyUngroupSelection(selectedIds: Set<string>, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const flattenedGroupIds = selectedGroupIds(selectedIds, nodes);
    if (!flattenedGroupIds.size && !nodes.some((node) => selectedIds.has(node.id) && node.metadata?.groupId)) return null;
    const releasedIds = new Set<string>();
    const updated = nodes
        .filter((node) => !flattenedGroupIds.has(node.id))
        .map((node) => {
            const groupId = node.metadata?.groupId;
            if (!groupId) return node;
            if (!flattenedGroupIds.has(groupId) && !selectedIds.has(node.id)) return node;
            releasedIds.add(node.id);
            return { ...node, metadata: { ...node.metadata, groupId: undefined } };
        });
    const next = withoutRemoved(updated, connections, new Set([...flattenedGroupIds, ...emptyGroupIds(updated)]));
    return { ...next, selectedIds: next.nodes.filter((node) => selectedIds.has(node.id) || releasedIds.has(node.id)).map((node) => node.id) };
}

export function findContainingGroupId(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;
    return (
        [...nodes]
            .reverse()
            .find((group) => isContainerNode(group) && group.id !== node.id && centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height)?.id ||
        undefined
    );
}

export function getConnectionTargetAnchor(node: CanvasNodeData, current: ConnectionHandle) {
    return {
        x: current.handleType === "source" ? node.position.x : node.position.x + node.width,
        y: node.position.y + node.height / 2,
    };
}

export function normalizeConnection(firstNodeId: string, secondNodeId: string, nodes: CanvasNodeData[], firstHandleType: "source" | "target") {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second || first.id === second.id) return null;
    const isGenerationSink = (type: CanvasNodeTypeId) => type === CanvasNodeType.Config || type === CanvasNodeType.ImageGeneration;
    if (isContainerNode(second)) return null;
    if (isGenerationSink(first.type) && isGenerationSink(second.type)) return null;
    if (isGenerationSink(second.type)) return { fromNodeId: first.id, toNodeId: second.id };
    if (isGenerationSink(first.type) && firstHandleType === "target") return { fromNodeId: second.id, toNodeId: first.id };
    if (isGenerationSink(first.type)) return { fromNodeId: first.id, toNodeId: second.id };
    return { fromNodeId: first.id, toNodeId: second.id };
}

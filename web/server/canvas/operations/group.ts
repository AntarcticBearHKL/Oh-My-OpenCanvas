import crypto from "node:crypto";

import type { CanvasNode, CanvasSnapshot } from "../types";
import { applyOps, findNode, isContainerNodeType, type CanvasToolRequest } from "./shared";

const GROUP_WRAP_PADDING = 24;
const GROUP_WRAP_TOP_PADDING = 52;

export function groupNodes(input: Record<string, unknown>, state: CanvasSnapshot | null): CanvasToolRequest {
    const data = input as { ids: string[]; title?: string };
    const members = data.ids.map((id) => findNode(state, id)).filter((node): node is CanvasNode => node !== undefined && !isContainerNodeType(node.type));
    if (members.length < 2) return applyOps([]);
    const left = Math.min(...members.map((node) => node.position.x));
    const top = Math.min(...members.map((node) => node.position.y));
    const right = Math.max(...members.map((node) => node.position.x + node.width));
    const bottom = Math.max(...members.map((node) => node.position.y + node.height));
    const groupId = `group-${crypto.randomUUID()}`;
    return applyOps([
        { type: "add_node", id: groupId, nodeType: "group", title: data.title, position: { x: left - GROUP_WRAP_PADDING, y: top - GROUP_WRAP_TOP_PADDING }, width: right - left + GROUP_WRAP_PADDING * 2, height: bottom - top + GROUP_WRAP_TOP_PADDING + GROUP_WRAP_PADDING },
        ...members.map((node) => ({ type: "update_node", id: node.id, metadata: { groupId } })),
        { type: "select_nodes", ids: [groupId] },
    ]);
}

export function ungroupNodes(input: Record<string, unknown>, state: CanvasSnapshot | null): CanvasToolRequest {
    const ids = (input as { ids: string[] }).ids;
    const nodes = state?.nodes || [];
    const groups = new Set(ids.filter((id) => findNode(state, id)?.type === "group"));
    const released = new Set(ids.filter((id) => findNode(state, id) !== undefined && !groups.has(id)));
    for (const node of nodes) if (node.metadata?.groupId && groups.has(String(node.metadata.groupId))) released.add(node.id);
    const emptyGroups = nodes.filter((node) => node.type === "group" && !groups.has(node.id) && !nodes.some((member) => member.metadata?.groupId === node.id && !released.has(member.id))).map((node) => node.id);
    return applyOps([
        ...[...released].map((id) => ({ type: "update_node", id, metadata: { groupId: null } })),
        ...(groups.size || emptyGroups.length ? [{ type: "delete_node", ids: [...groups, ...emptyGroups] }] : []),
    ]);
}

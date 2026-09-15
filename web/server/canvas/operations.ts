import crypto from "node:crypto";

import type { ToolName } from "./schemas";
import { nextCanvasX } from "./tools";
import type { CanvasNode, CanvasNodeType, CanvasSnapshot } from "./types";

type CanvasToolRequest = { name: "canvas_apply_ops"; input: Record<string, unknown> };
type AlignMode = "left" | "center-x" | "right" | "top" | "center-y" | "bottom" | "distribute-x" | "distribute-y";

const GROUP_WRAP_PADDING = 24;
const GROUP_WRAP_TOP_PADDING = 52;

/** 将上层画布工具调用转换为前端可执行的批量操作。 */
export function buildCanvasToolRequest(name: ToolName, input: Record<string, unknown>, state: CanvasSnapshot | null): CanvasToolRequest {
    if (name === "canvas_apply_ops") return { name, input };
    if (name === "canvas_create_node") {
        const data = input as { nodeType: CanvasNodeType; title?: string; x?: number; y?: number; width?: number; height?: number; metadata?: Record<string, unknown> };
        return applyOps([{ type: "add_node", nodeType: data.nodeType, title: data.title, position: { x: data.x ?? nextCanvasX(state), y: data.y ?? 0 }, width: data.width, height: data.height, metadata: data.metadata }]);
    }
    if (name === "canvas_create_text_node") {
        const data = input as { text?: string; x?: number; y?: number; title?: string; width?: number; height?: number };
        return applyOps([textNodeOp(data, data.x ?? nextCanvasX(state), data.y ?? 0)]);
    }
    if (name === "canvas_create_text_nodes") {
        const data = input as { items: Array<{ text: string; title?: string; x?: number; y?: number; width?: number; height?: number }>; x?: number; y?: number; gap?: number; direction?: "row" | "column" };
        const x = Number(data.x ?? nextCanvasX(state));
        const y = Number(data.y ?? 0);
        const gap = Number(data.gap ?? 40);
        return applyOps(data.items.map((item, index) => textNodeOp(item, item.x ?? (data.direction === "row" ? x + index * (340 + gap) : x), item.y ?? (data.direction === "row" ? y : y + index * (240 + gap)))));
    }
    if (name === "canvas_create_image_prompt_flow") return applyOps(generationFlowOps({ ...input, mode: "image" }, state));
    if (name === "canvas_create_config_node") {
        const x = Number(input.x ?? nextCanvasX(state));
        const y = Number(input.y ?? 0);
        const configId = `config-${crypto.randomUUID()}`;
        const mode = generationMode(input.mode);
        const prompt = String(input.prompt || "");
        return applyOps([configNodeOp(configId, input, x, y), ...(input.autoRun ? [runGenerationOp(configId, mode, prompt)] : [])]);
    }
    if (name === "canvas_create_generation_flow") return applyOps(generationFlowOps(input, state));
    if (name === "canvas_generate_text" || name === "canvas_generate_image" || name === "canvas_generate_video" || name === "canvas_generate_audio") {
        return applyOps(generationFlowOps({ ...input, mode: name.replace("canvas_generate_", ""), autoRun: true }, state));
    }
    if (name === "canvas_update_node") {
        const data = input as { id: string; patch?: Record<string, unknown>; metadata?: Record<string, unknown> };
        return applyOps([{ type: "update_node", id: data.id, patch: data.patch, metadata: data.metadata }]);
    }
    if (name === "canvas_update_node_text") {
        const data = input as { id: string; text: string; title?: string };
        return applyOps([{ type: "update_node", id: data.id, patch: { ...(data.title ? { title: data.title } : {}) }, metadata: { content: data.text, status: "success" } }]);
    }
    if (name === "canvas_move_nodes") {
        const data = input as { items: Array<{ id: string; x?: number; y?: number; dx?: number; dy?: number }> };
        return applyOps(data.items.map((item) => {
            const current = findNode(state, item.id);
            return { type: "update_node", id: item.id, patch: { position: { x: item.x ?? ((current?.position.x || 0) + (item.dx || 0)), y: item.y ?? ((current?.position.y || 0) + (item.dy || 0)) } } };
        }));
    }
    if (name === "canvas_resize_node") {
        const data = input as { id: string; width: number; height: number; freeResize?: boolean };
        return applyOps([{ type: "update_node", id: data.id, patch: { width: data.width, height: data.height }, metadata: data.freeResize === undefined ? undefined : { freeResize: data.freeResize } }]);
    }
    if (name === "canvas_set_node_flags") {
        const data = input as { ids: string[]; locked?: boolean; hidden?: boolean };
        const metadata: Record<string, unknown> = {};
        if (data.locked !== undefined) metadata.locked = data.locked;
        if (data.hidden !== undefined) metadata.hidden = data.hidden;
        if (!Object.keys(metadata).length) throw new Error("locked 与 hidden 至少需要一个");
        return applyOps(data.ids.map((id) => ({ type: "update_node", id, metadata })));
    }
    if (name === "canvas_bulk_rename") {
        const data = input as { ids: string[]; title: string };
        const title = data.title.trim();
        if (!title) return applyOps([]);
        return applyOps(data.ids.map((id, index) => ({ type: "update_node", id, patch: { title: data.ids.length > 1 ? `${title} ${index + 1}` : title } })));
    }
    if (name === "canvas_align_nodes") return applyOps(alignOps(input as { ids: string[]; mode: AlignMode }, state));
    if (name === "canvas_group_nodes") {
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
    if (name === "canvas_ungroup_nodes") {
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
    if (name === "canvas_duplicate_node") {
        const data = input as { id: string; dx?: number; dy?: number };
        const source = findNode(state, data.id);
        if (!source) return applyOps([]);
        const copyId = `copy-${crypto.randomUUID()}`;
        return applyOps([
            { type: "add_node", id: copyId, nodeType: source.type, title: source.title, position: { x: source.position.x + (data.dx ?? 40), y: source.position.y + (data.dy ?? 40) }, width: source.width, height: source.height, metadata: source.metadata },
            { type: "select_nodes", ids: [copyId] },
        ]);
    }
    if (name === "canvas_delete_nodes") return applyOps([{ type: "delete_node", ids: (input as { ids: string[] }).ids }]);
    if (name === "canvas_connect_nodes") {
        const data = input as { connections: Array<{ fromNodeId: string; toNodeId: string }> };
        return applyOps(data.connections.map((connection) => ({ type: "connect_nodes", ...connection })));
    }
    if (name === "canvas_select_nodes") return applyOps([{ type: "select_nodes", ids: (input as { ids: string[] }).ids }]);
    if (name === "canvas_set_viewport") return applyOps([{ type: "set_viewport", viewport: (input as { viewport: unknown }).viewport }]);
    if (name === "canvas_run_generation") {
        const data = input as { nodeId: string; mode?: string; prompt?: string };
        return applyOps([runGenerationOp(data.nodeId, generationMode(data.mode), data.prompt)]);
    }
    throw new Error(`未知工具：${name}`);
}

/** 创建统一的批量画布操作请求。 */
function applyOps(ops: unknown[]): CanvasToolRequest {
    return { name: "canvas_apply_ops", input: { ops } };
}

/** 创建文本节点操作。 */
function textNodeOp(input: { id?: string; text?: string; title?: string; width?: number; height?: number }, x: number, y: number) {
    return { type: "add_node", id: input.id, nodeType: "text", title: input.title, position: { x, y }, width: input.width, height: input.height, metadata: { content: input.text || "", status: "success", fontSize: 14 } };
}

/** 创建生成配置节点操作。 */
function configNodeOp(id: string, input: Record<string, unknown>, x: number, y: number) {
    const mode = generationMode(input.mode);
    const prompt = String(input.prompt || "");
    return {
        type: "add_node",
        id,
        nodeType: "config",
        title: String(input.title || generationTitle(mode)),
        position: { x, y },
        width: typeof input.width === "number" ? input.width : undefined,
        height: typeof input.height === "number" ? input.height : undefined,
        metadata: cleanRecord({
            generationMode: mode,
            composerContent: prompt,
            prompt,
            status: "idle",
            model: input.model,
            size: input.size,
            quality: input.quality,
            count: input.count,
            seconds: input.seconds,
            vquality: input.vquality,
            generateAudio: input.generateAudio,
            watermark: input.watermark,
            videoMode: input.videoMode,
            audioVoice: input.audioVoice,
            audioFormat: input.audioFormat,
            audioSpeed: input.audioSpeed,
            audioInstructions: input.audioInstructions,
        }),
    };
}

/** 创建包含提示词、配置节点和引用连线的生成流程。 */
function generationFlowOps(input: Record<string, unknown>, state: CanvasSnapshot | null) {
    const mode = generationMode(input.mode);
    const prompt = String(input.prompt || "");
    const x = Number(input.x ?? nextCanvasX(state));
    const y = Number(input.y ?? 0);
    const textId = `text-${crypto.randomUUID()}`;
    const configId = `config-${crypto.randomUUID()}`;
    const referenceNodeIds = Array.isArray(input.referenceNodeIds) ? input.referenceNodeIds.filter((id): id is string => typeof id === "string") : [];
    // When the prompt only @-mentions nodes already passed as references, reuse them instead of minting a duplicate text node.
    const mentionedIds = [...prompt.matchAll(/@\[node:([\w-]+)\]/g)].map((match) => match[1]);
    const reuseReferences = referenceNodeIds.length > 0 && mentionedIds.length > 0
        && mentionedIds.every((id) => referenceNodeIds.includes(id))
        && prompt.replace(/@\[node:[\w-]+\]/g, "").trim() === "";
    const tokens = reuseReferences ? referenceNodeIds.map((id) => `@[node:${id}]`) : [`@[node:${textId}]`, ...referenceNodeIds.map((id) => `@[node:${id}]`)];
    return [
        ...(reuseReferences ? [] : [textNodeOp({ id: textId, text: prompt, title: String(input.title || "提示词") }, x, y)]),
        configNodeOp(configId, { ...input, prompt: tokens.join("\n") }, x + 420, y),
        ...(reuseReferences ? [] : [{ type: "connect_nodes", fromNodeId: textId, toNodeId: configId }]),
        ...referenceNodeIds.map((fromNodeId) => ({ type: "connect_nodes", fromNodeId, toNodeId: configId })),
        { type: "select_nodes", ids: [configId] },
        ...(input.autoRun ? [runGenerationOp(configId, mode, tokens.join("\n"))] : []),
    ];
}

/** 创建触发节点生成的画布操作。 */
function runGenerationOp(nodeId: string, mode: "text" | "image" | "video" | "audio", prompt?: string) {
    return { type: "run_generation", nodeId, mode, prompt };
}

/** 将未知生成模式归一为画布支持的模式。 */
function generationMode(value: unknown): "text" | "image" | "video" | "audio" {
    return value === "text" || value === "video" || value === "audio" ? value : "image";
}

/** 获取生成模式对应的默认节点标题。 */
function generationTitle(mode: "text" | "image" | "video" | "audio") {
    if (mode === "text") return "文本生成";
    if (mode === "video") return "视频生成";
    if (mode === "audio") return "音频生成";
    return "图片生成";
}

/** 按节点 ID 查找当前画布节点。 */
function findNode(state: CanvasSnapshot | null, id: string): CanvasNode | undefined {
    return (state?.nodes || []).find((node) => node.id === id);
}

function isContainerNodeType(type: string) {
    return type === "group" || type === "frame";
}

function alignOps(data: { ids: string[]; mode: AlignMode }, state: CanvasSnapshot | null) {
    const nodes = data.ids.map((id) => findNode(state, id)).filter((node): node is CanvasNode => node !== undefined);
    if (nodes.length < 2) return [];
    const left = Math.min(...nodes.map((node) => node.position.x));
    const top = Math.min(...nodes.map((node) => node.position.y));
    const right = Math.max(...nodes.map((node) => node.position.x + node.width));
    const bottom = Math.max(...nodes.map((node) => node.position.y + node.height));
    if (data.mode === "distribute-x" || data.mode === "distribute-y") {
        if (nodes.length < 3) return [];
        const horizontal = data.mode === "distribute-x";
        const sorted = [...nodes].sort((a, b) => (horizontal ? a.position.x - b.position.x : a.position.y - b.position.y));
        const used = sorted.reduce((total, node) => total + (horizontal ? node.width : node.height), 0);
        const gap = ((horizontal ? right - left : bottom - top) - used) / (sorted.length - 1);
        let cursor = horizontal ? left : top;
        return sorted.map((node) => {
            const position = { x: horizontal ? Math.round(cursor) : node.position.x, y: horizontal ? node.position.y : Math.round(cursor) };
            cursor += (horizontal ? node.width : node.height) + gap;
            return { type: "update_node", id: node.id, patch: { position } };
        });
    }
    return nodes.map((node) => {
        const x = data.mode === "left" ? left : data.mode === "center-x" ? left + (right - left - node.width) / 2 : data.mode === "right" ? right - node.width : node.position.x;
        const y = data.mode === "top" ? top : data.mode === "center-y" ? top + (bottom - top - node.height) / 2 : data.mode === "bottom" ? bottom - node.height : node.position.y;
        return { type: "update_node", id: node.id, patch: { position: { x: Math.round(x), y: Math.round(y) } } };
    });
}

/** 移除对象中未设置的生成参数。 */
function cleanRecord(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

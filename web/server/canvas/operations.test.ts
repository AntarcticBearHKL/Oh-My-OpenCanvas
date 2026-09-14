import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCanvasToolRequest } from "./operations";
import { toolInputSchemas } from "./schemas";

type CanvasOp = { type: string; nodeType?: string; metadata?: { prompt?: unknown }; fromNodeId?: string; toNodeId?: string };

function opsOf(name: Parameters<typeof buildCanvasToolRequest>[0], input: Record<string, unknown>) {
    const request = buildCanvasToolRequest(name, input, null);
    return (request.input as { ops: CanvasOp[] }).ops;
}

test("generation flow reuses referenced nodes when the prompt only mentions them", () => {
    const ops = opsOf("canvas_generate_image", { prompt: "@[node:text-1]", referenceNodeIds: ["text-1"], title: "Flow", autoRun: true });
    const addedTextNodes = ops.filter((op) => op.type === "add_node" && op.nodeType === "text");
    const config = ops.find((op) => op.type === "add_node" && op.nodeType === "config");
    const runs = ops.filter((op) => op.type === "run_generation");
    assert.equal(addedTextNodes.length, 0);
    assert.equal(ops.filter((op) => op.type === "connect_nodes" && op.fromNodeId === "text-1" && String(op.toNodeId).startsWith("config-")).length, 1);
    assert.match(String(config?.metadata?.prompt), /^@\[node:text-1\]$/);
    assert.equal(runs.length, 1);
});

test("generation flow still creates a prompt node for prose prompts", () => {
    const ops = opsOf("canvas_generate_image", { prompt: "a cat on a roof", referenceNodeIds: ["text-1"], autoRun: true });
    assert.equal(ops.filter((op) => op.type === "add_node" && op.nodeType === "text").length, 1);
    const config = ops.find((op) => op.type === "add_node" && op.nodeType === "config");
    assert.match(String(config?.metadata?.prompt), /@\[node:text-/);
});

test("smart canvas ops and node types are accepted by tool schemas", () => {
    const ops = toolInputSchemas.canvas_apply_ops.parse({ ops: [{ type: "arrange_board", id: "board-1" }, { type: "place_on_board", nodeId: "image-1", boardId: "board-1" }, { type: "place_on_board", nodeId: "image-1" }] }).ops;
    assert.deepEqual(ops, [
        { type: "arrange_board", id: "board-1" },
        { type: "place_on_board", nodeId: "image-1", boardId: "board-1" },
        { type: "place_on_board", nodeId: "image-1" },
    ]);
    assert.equal(toolInputSchemas.canvas_create_node.parse({ nodeType: "smart-canvas" }).nodeType, "smart-canvas");
    assert.equal(toolInputSchemas.canvas_create_node.parse({ nodeType: "image-generation" }).nodeType, "image-generation");
});

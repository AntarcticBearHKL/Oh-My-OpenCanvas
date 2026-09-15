import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const BASE = process.env.E2E_BASE || "http://127.0.0.1:3000";
const PORT = Number(process.env.E2E_CDP_PORT || 9333);
const ARTIFACTS = resolve("e2e", "artifacts", new Date().toISOString().replace(/[:.]/g, "-"));
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find((path) => existsSync(path));

const LIB_ASSERTIONS = `(async () => {
    const results = [];
    const ok = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail === undefined ? "" : String(detail) });
    const board = { id: "b", type: "smart-canvas", title: "b", position: { x: 0, y: 0 }, width: 640, height: 360, metadata: {} };
    const image = (id, width, height, position) => ({ id, type: "image", title: id, position: position || { x: 0, y: 0 }, width, height, metadata: { naturalWidth: width, naturalHeight: height } });

    const smart = await import("/src/lib/canvas/smart-canvas.ts");
    ok("ratio default", smart.smartCanvasRatio(board) === "16:9", smart.smartCanvasRatio(board));
    ok("resolution default", smart.smartCanvasResolution(board) === "2k", smart.smartCanvasResolution(board));
    ok("background default", smart.smartCanvasBackground(board) === "transparent", smart.smartCanvasBackground(board));
    ok("texts default", Array.isArray(smart.smartCanvasTexts(board)) && smart.smartCanvasTexts(board).length === 0);
    const ratioSize = smart.smartCanvasSizeForRatio("16:9");
    ok("size 16:9", Math.abs(ratioSize.width / ratioSize.height - 16 / 9) < 0.01, JSON.stringify(ratioSize));
    ok("arrange empty", JSON.stringify(smart.arrangeBoardImages(board, [])) === "[]");

    const one = smart.arrangeBoardImages(board, [image("a", 240, 120)]);
    ok("arrange 1 cols=1, gap 16, centred", one[0].width === 608 && one[0].height === 304 && one[0].position.x === 16 && one[0].position.y === 28, JSON.stringify(one[0]));

    const three = smart.arrangeBoardImages(board, [image("a", 400, 300), image("b", 1000, 100), image("c", 50, 50)]);
    ok("arrange 3 grid", three[0].width === 208 && three[0].height === 156 && three[1].width === 296 && three[2].height === 156, JSON.stringify(three));
    ok("arrange 3 aspect kept", Math.abs(three[1].width / three[1].height - 1000 / 100) < 0.2, three[1].width / three[1].height);
    ok("arrange 3 rounded", three.every((item) => Number.isInteger(item.position.x) && Number.isInteger(item.position.y) && Number.isInteger(item.width) && Number.isInteger(item.height)));

    ok("layout templates ordered", smart.BOARD_LAYOUT_TEMPLATES.join(",") === "grid,row,column,feature", smart.BOARD_LAYOUT_TEMPLATES.join(","));
    const layoutImages = [image("a", 100, 100), image("b", 100, 100), image("c", 100, 100)];
    const gridNamed = JSON.stringify(smart.arrangeBoardImages(board, layoutImages, "grid"));
    ok("grid template keeps default output", gridNamed === JSON.stringify(smart.arrangeBoardImages(board, layoutImages)), gridNamed);
    const row = smart.arrangeBoardImages(board, layoutImages, "row");
    ok("row template one row", row.every((item) => item.position.y === row[0].position.y) && row[0].position.x < row[1].position.x && row[1].position.x < row[2].position.x, JSON.stringify(row));
    ok("row template aspect fit integers", row.every((item) => item.width === 192 && item.height === 192 && Number.isInteger(item.position.x) && Number.isInteger(item.position.y)), JSON.stringify(row));
    const column = smart.arrangeBoardImages(board, layoutImages, "column");
    ok("column template one column", column.every((item) => item.position.x === column[0].position.x) && column[0].position.y < column[1].position.y && column[1].position.y < column[2].position.y, JSON.stringify(column));
    ok("column template aspect fit integers", column.every((item) => item.width === column[0].width && item.height === column[0].height && Number.isInteger(item.width) && Number.isInteger(item.height)), JSON.stringify(column));
    const feature = smart.arrangeBoardImages(board, layoutImages, "feature");
    ok("feature template keeps first image dominant", feature[0].width > feature[1].width && feature[0].height > feature[1].height && feature[0].position.x < feature[1].position.x, JSON.stringify(feature));
    ok("feature template aspect fit integers", feature.every((item) => Number.isInteger(item.width) && Number.isInteger(item.height) && Number.isInteger(item.position.x) && Number.isInteger(item.position.y)), JSON.stringify(feature));
    const rowAspect = smart.arrangeBoardImages(board, [image("w", 400, 100), image("t", 100, 400)], "row");
    ok("row template keeps aspect", Math.abs(rowAspect[0].width / rowAspect[0].height - 4) < 0.05 && Math.abs(rowAspect[1].width / rowAspect[1].height - 0.25) < 0.01, JSON.stringify(rowAspect));

    const layered = { ...board, metadata: { boardLayers: ["c", "a"] } };
    const placed = [image("a", 100, 100), image("b", 100, 100), image("c", 100, 100), image("d", 100, 100)];
    ok("layers empty by default", JSON.stringify(smart.smartCanvasLayers(board)) === "[]", JSON.stringify(smart.smartCanvasLayers(board)));
    ok("layers read metadata", smart.smartCanvasLayers(layered).join(",") === "c,a", smart.smartCanvasLayers(layered).join(","));
    ok("layer ids put layers first then leftovers", smart.boardLayerImageIds(layered, placed).join(",") === "c,a,b,d", smart.boardLayerImageIds(layered, placed).join(","));
    const droppedLayers = smart.boardLayerImageIds({ ...board, metadata: { boardLayers: ["missing", "b"] } }, placed);
    ok("layer ids drop missing images", droppedLayers.join(",") === "b,a,c,d", droppedLayers.join(","));
    const hiddenImage = { ...placed[1], metadata: { ...placed[1].metadata, hidden: true } };
    const orderedImages = smart.orderBoardImages(layered, [placed[0], hiddenImage, placed[2], placed[3]]);
    ok("orderBoardImages drops hidden and follows layers", orderedImages.map((item) => item.id).join(",") === "c,a,d", orderedImages.map((item) => item.id).join(","));
    ok("moveBoardLayer forward steps toward front", smart.moveBoardLayer(layered, placed, "c", "forward").join(",") === "a,c,b,d", smart.moveBoardLayer(layered, placed, "c", "forward").join(","));
    ok("moveBoardLayer backward steps toward back", smart.moveBoardLayer(layered, placed, "a", "backward").join(",") === "a,c,b,d", smart.moveBoardLayer(layered, placed, "a", "backward").join(","));
    ok("moveBoardLayer forward at front is a no-op", smart.moveBoardLayer(layered, placed, "d", "forward").join(",") === "c,a,b,d", smart.moveBoardLayer(layered, placed, "d", "forward").join(","));
    ok("moveBoardLayer backward at back is a no-op", smart.moveBoardLayer(layered, placed, "c", "backward").join(",") === "c,a,b,d", smart.moveBoardLayer(layered, placed, "c", "backward").join(","));
    ok("moveBoardLayer unknown id is a no-op", smart.moveBoardLayer(layered, placed, "zz", "forward").join(",") === "c,a,b,d", smart.moveBoardLayer(layered, placed, "zz", "forward").join(","));

    const nestedBoard = { id: "nb", type: "smart-canvas", title: "nb", position: { x: 0, y: 0 }, width: 100, height: 100, metadata: {} };
    const mixedLayers = { ...board, metadata: { boardLayers: ["nb", "a"] } };
    const mixedPlaced = [image("a", 100, 100), nestedBoard, image("z", 100, 100)];
    ok("mixed layer ids order boards and images", smart.boardLayerImageIds(mixedLayers, mixedPlaced).join(",") === "nb,a,z", smart.boardLayerImageIds(mixedLayers, mixedPlaced).join(","));
    ok("mixed moveBoardLayer reorders boards", smart.moveBoardLayer(mixedLayers, mixedPlaced, "a", "forward").join(",") === "nb,z,a", smart.moveBoardLayer(mixedLayers, mixedPlaced, "a", "forward").join(","));
    const hiddenBoard = { ...nestedBoard, metadata: { hidden: true } };
    const hiddenBoardOrder = smart.orderBoardImages(mixedLayers, [image("a", 100, 100), hiddenBoard, image("z", 100, 100)]);
    ok("orderBoardImages drops hidden boards", hiddenBoardOrder.map((item) => item.id).join(",") === "a,z", hiddenBoardOrder.map((item) => item.id).join(","));

    const image2 = await import("/src/lib/canvas/canvas-image-data.ts");
    ok("upscale clamp max", image2.resolveUpscaleSize(100, 100, 99999).width === 4096, JSON.stringify(image2.resolveUpscaleSize(100, 100, 99999)));
    const down = image2.resolveUpscaleSize(1000, 500, 200);
    ok("downscale keeps aspect", Math.abs(down.width / down.height - 2) < 0.02 && down.width <= 200, JSON.stringify(down));
    ok("downscale min clamp", image2.resolveUpscaleSize(1000, 500, 1).width >= 64, JSON.stringify(image2.resolveUpscaleSize(1000, 500, 1)));

    const geo = await import("/src/lib/canvas/canvas-node-geometry.ts");
    const target = image("t", 100, 100, { x: 300, y: 0 });
    const dragged = image("d", 100, 100, { x: 0, y: 0 });
    const snapped = geo.snapDragToGuides([{ id: "d", x: 0, y: 0 }], [target, dragged], 197, 0, 6);
    ok("snap pulls to edge", snapped.dx === 200 && snapped.guides.x[0] === 300, JSON.stringify(snapped));
    const missed = geo.snapDragToGuides([{ id: "d", x: 0, y: 0 }], [image("t2", 100, 100, { x: 900, y: 900 }), dragged], 10, 10, 6);
    ok("snap no match keeps delta", missed.dx === 10 && missed.dy === 10 && missed.guides.x.length === 0, JSON.stringify(missed));
    ok("center inside", geo.nodeCenterInside(image("i", 100, 100, { x: 50, y: 50 }), board) === true);
    const gridSnapped = geo.snapDragToGuides([{ id: "d", x: 7, y: 9 }], [dragged], 3, 3, 0, 16);
    ok("grid snap rounds to 16", gridSnapped.dx === 9 && gridSnapped.dy === 7, JSON.stringify(gridSnapped));
    const guideBeatsGrid = geo.snapDragToGuides([{ id: "d", x: 0, y: 0 }], [target, dragged], 197, 0, 6, 16);
    ok("grid defers to guides", guideBeatsGrid.dx === 200 && guideBeatsGrid.guides.x[0] === 300, JSON.stringify(guideBeatsGrid));
    ok("grid off by default", geo.snapDragToGuides([{ id: "d", x: 7, y: 9 }], [dragged], 3, 3, 0).dx === 3);

    const frame = { id: "f", type: "frame", title: "f", position: { x: 0, y: 0 }, width: 400, height: 300, metadata: {} };
    const inside = image("in", 100, 100, { x: 150, y: 100 });
    const outside = image("out", 100, 100, { x: 900, y: 900 });
    ok("frame is container", geo.isContainerNode(frame) === true && geo.isContainerNode(dragged) === false);
    ok("drop adopts into frame", geo.findGroupDropTarget(new Set(["in"]), [frame, inside, outside])?.id === "f");
    ok("frame never nests", geo.findGroupDropTarget(new Set(["f"]), [frame, inside]) === null && geo.findContainingGroupId(frame, [frame, inside]) === undefined);
    const nested = geo.snapNodesIntoGroup(new Set(["in"]), [frame, inside, outside], frame).find((node) => node.id === "in");
    ok("snap into frame keeps position and sets groupId", nested.metadata.groupId === "f" && nested.position.x === 150 && nested.position.y === 100, JSON.stringify(nested));
    ok("containing frame resolves", geo.findContainingGroupId(inside, [frame, inside]) === "f" && geo.findContainingGroupId(outside, [frame, outside]) === undefined);
    ok("frame rejects connections as target", geo.normalizeConnection("in", "f", [frame, inside], "source") === null && geo.normalizeConnection("f", "in", [frame, inside], "source").fromNodeId === "f");

    const boardA = { id: "ba", type: "smart-canvas", title: "A", position: { x: 0, y: 0 }, width: 640, height: 360, metadata: {} };
    const boardB = { id: "bb", type: "smart-canvas", title: "B", position: { x: 80, y: 60 }, width: 200, height: 150, metadata: { boardId: "ba" } };
    const boardC = { id: "bc", type: "smart-canvas", title: "C", position: { x: 100, y: 80 }, width: 80, height: 60, metadata: { boardId: "bb" } };
    const boardTree = [boardA, boardB, boardC];
    ok("board descendant direct", geo.isBoardDescendant("bb", "ba", boardTree) === true);
    ok("board descendant indirect", geo.isBoardDescendant("bc", "ba", boardTree) === true);
    ok("board descendant never self or ancestor", geo.isBoardDescendant("ba", "ba", boardTree) === false && geo.isBoardDescendant("ba", "bc", boardTree) === false);
    ok("board drop accepts image", geo.findBoardDropTarget(new Set(["bimg"]), [boardA, image("bimg", 100, 100, { x: 40, y: 40 })])?.id === "ba");
    ok("board drop accepts board", geo.findBoardDropTarget(new Set(["bb"]), [boardA, boardB])?.id === "ba");
    ok("board drop rejects self", geo.findBoardDropTarget(new Set(["bb"]), [boardB]) === null);
    ok("board drop rejects descendant cycle", geo.findBoardDropTarget(new Set(["ba"]), boardTree) === null);
    ok("board drop rejects non-board target", geo.findBoardDropTarget(new Set(["bimg"]), [frame, image("bimg", 100, 100, { x: 40, y: 40 })]) === null);

    ok("locked flag predicate", geo.isNodeLocked({ ...dragged, metadata: { locked: true } }) === true && geo.isNodeLocked(dragged) === false);
    ok("hidden flag predicate", geo.isNodeHidden({ ...dragged, metadata: { hidden: true } }) === true && geo.isNodeHidden(dragged) === false);
    const textNode = { id: "txt", type: "text", title: "txt", position: { x: 0, y: 0 }, width: 100, height: 100, metadata: {} };
    const nodeList = [frame, inside, outside, textNode];
    ok("type filter all", geo.filterNodesByType(nodeList, "all").length === 4);
    ok("type filter image", geo.filterNodesByType(nodeList, "image").map((node) => node.id).join(",") === "in,out");
    ok("type filter unknown", geo.filterNodesByType(nodeList, "video").length === 0);
    ok("bulk rename single", geo.bulkRenameTitles(["a"], " 名字 ").get("a") === "名字");
    const bulk = geo.bulkRenameTitles(["a", "b"], "名字");
    ok("bulk rename numbered", bulk.get("a") === "名字 1" && bulk.get("b") === "名字 2");
    ok("bulk rename blank", geo.bulkRenameTitles(["a", "b"], "   ").size === 0);

    const align = await import("/src/lib/canvas/alignment.ts");
    const trio = [
        { id: "a", type: "image", title: "a", position: { x: 100, y: 50 }, width: 100, height: 100, metadata: {} },
        { id: "b", type: "image", title: "b", position: { x: 300, y: 400 }, width: 50, height: 50, metadata: {} },
        { id: "c", type: "image", title: "c", position: { x: 600, y: 200 }, width: 200, height: 20, metadata: {} },
    ];
    const sel = new Set(["a", "b", "c"]);
    const topAligned = align.alignNodes(trio, sel, "top");
    ok("align top", topAligned.get("a").y === 50 && topAligned.get("b").y === 50 && topAligned.get("c").y === 50, JSON.stringify([...topAligned]));
    const rightAligned = align.alignNodes(trio, sel, "right");
    ok("align right", rightAligned.get("a").x === 700 && rightAligned.get("c").x === 600, JSON.stringify([...rightAligned]));
    const centreY = align.alignNodes(trio, sel, "center-y");
    ok("align center-y", centreY.get("b").y === 225 && centreY.get("c").y === 240, JSON.stringify([...centreY]));
    const spreadX = align.alignNodes(trio, sel, "distribute-x");
    ok("distribute-x equal gaps", spreadX.get("a").x === 100 && spreadX.get("b").x === 375 && spreadX.get("c").x === 600, JSON.stringify([...spreadX]));
    ok("align needs two", align.alignNodes(trio, new Set(["a"]), "left").size === 0);
    ok("distribute needs three", align.alignNodes(trio, new Set(["a", "b"]), "distribute-y").size === 0);

    const generation = await import("/src/lib/canvas/canvas-generation-helpers.ts");
    ok("generation limits", generation.GENERATION_CONCURRENCY === 2 && generation.GENERATION_MAX_ATTEMPTS === 3 && generation.GENERATION_VERSION_LIMIT === 5 && generation.GENERATION_RETRY_DELAY_MS === 2000);

    const queue = generation.createGenerationQueue();
    await Promise.all(
        ["a", "b", "c", "d", "e"].map((id) =>
            queue.run(id, async () => {
                await new Promise((resolveTask) => setTimeout(resolveTask, 0));
                return id;
            }),
        ),
    );
    const snapshot = queue.snapshot();
    ok("queue caps concurrency at 2", snapshot.peak === 2, JSON.stringify(snapshot));
    ok("queue starts tasks FIFO", snapshot.started.join(",") === "a,b,c,d,e", snapshot.started.join(","));
    ok("queue releases tasks FIFO", snapshot.finished.join(",") === "a,b,c,d,e", snapshot.finished.join(","));

    let attempts = 0;
    await generation.runGenerationTaskWithRetry(async () => {
        attempts += 1;
        throw new Error("boom");
    }, { delayMs: 0 }).catch(() => null);
    ok("retry caps at 3 attempts", attempts === 3, attempts);

    let recovered = 0;
    const recoveredValue = await generation.runGenerationTaskWithRetry(async () => {
        recovered += 1;
        if (recovered < 2) throw new Error("flaky");
        return "done";
    }, { delayMs: 0 });
    ok("retry recovers before cap", recoveredValue === "done" && recovered === 2, recovered);

    let versions = [];
    for (let index = 0; index < 7; index += 1) versions = generation.pushGenerationVersion(versions, { id: String(index), prompt: "p", seed: index, createdAt: index });
    ok("versions pruned to 5 newest", versions.length === 5 && versions[0].id === "6" && versions[4].id === "2", versions.map((version) => version.id).join(","));

    const version = { id: "v", prompt: "p", seed: 12345, createdAt: 1 };
    ok("seed round-trips through versions", generation.resolveGenerationSeed(generation.pushGenerationVersion(undefined, version)) === 12345, generation.resolveGenerationSeed(generation.pushGenerationVersion(undefined, version)));

    const cost = await import("/src/lib/canvas/generation-cost.ts");
    const unpriced = cost.estimateGenerationCost("openrouter::mystery-model", "image", 1);
    ok("cost unpriced model is explicit", unpriced.priced === false && unpriced.usd === 0 && unpriced.reason === "unpriced-model", JSON.stringify(unpriced));
    const mismatched = cost.estimateGenerationCost("openrouter::gpt-image-1", "video-second", 1);
    ok("cost unit mismatch is explicit", mismatched.priced === false && mismatched.usd === 0 && mismatched.reason === "unpriced-unit", JSON.stringify(mismatched));
    ok("cost decodes channel model id", cost.priceModelId("openrouter:: GPT-Image-1 ") === "gpt-image-1", cost.priceModelId("openrouter:: GPT-Image-1 "));
    const billed = cost.estimateGenerationCost("openrouter::gpt-image-1", "image", 3);
    ok("cost prices known model by quantity", billed.priced === true && billed.usd === Number((cost.MODEL_PRICES["gpt-image-1"].usd * 3).toFixed(6)), JSON.stringify(billed));
    const invalid = cost.estimateGenerationCost("gpt-image-1", "image", 0);
    ok("cost rejects non-positive quantity", invalid.priced === false && invalid.reason === "unpriced-unit", JSON.stringify(invalid));
    ok("cost formatUsd uses two decimals", cost.formatUsd(1.234) === "$1.23" && cost.formatUsd(0.037) === "$0.04" && cost.formatUsd(0) === "$0.00", cost.formatUsd(1.234) + "," + cost.formatUsd(0.037) + "," + cost.formatUsd(0));

    const matrix = await import("/src/lib/canvas/generation-matrix.ts");
    const variants = matrix.buildMatrixVariants({ sizes: ["1024x1024", "512x512"], counts: [1, 2], prompts: ["sunset", "city"] });
    const labels = variants.map((variant) => variant.prompt + "|" + variant.count + "|" + variant.size).join(",");
    ok("matrix 2x2x2 yields eight variants", variants.length === 8, variants.length);
    ok("matrix order prompts outer sizes inner", labels === "sunset|1|1024x1024,sunset|1|512x512,sunset|2|1024x1024,sunset|2|512x512,city|1|1024x1024,city|1|512x512,city|2|1024x1024,city|2|512x512", labels);
    ok("matrix empty input yields none", matrix.buildMatrixVariants(undefined).length === 0 && matrix.buildMatrixVariants({}).length === 0 && matrix.buildMatrixVariants({ sizes: ["  "], counts: [0, -1, Number.NaN] }).length === 0);
    const single = matrix.buildMatrixVariants({ prompts: ["a", " b ", "  "] });
    ok("matrix single dimension expands once", single.length === 2 && single[0].prompt === "a" && single[1].prompt === "b" && single[0].size === undefined && single[0].count === undefined, JSON.stringify(single));
    ok("matrix describes variant", matrix.describeMatrixVariant({ size: "1024x1024", count: 2, prompt: "sunset" }) === "1024x1024 · x2 · sunset", matrix.describeMatrixVariant({ size: "1024x1024", count: 2, prompt: "sunset" }));
    const blankOnly = matrix.buildMatrixVariants({ prompts: ["keep", " ", "\\n"], sizes: ["   "], counts: [] });
    ok("matrix drops blank-only entries", blankOnly.length === 1 && blankOnly[0].prompt === "keep" && blankOnly[0].size === undefined && blankOnly[0].count === undefined, JSON.stringify(blankOnly));
    const badCounts = matrix.buildMatrixVariants({ counts: [2, 0, -4, Number.NaN, Number.POSITIVE_INFINITY, 2] });
    ok("matrix drops bad counts and keeps duplicates", badCounts.length === 2 && badCounts.every((variant) => variant.count === 2), JSON.stringify(badCounts));
    const sizeOnly = matrix.buildMatrixVariants({ sizes: ["1024x1024", "512x512"] });
    ok("matrix sizes-only product", sizeOnly.length === 2 && sizeOnly[0].size === "1024x1024" && sizeOnly[1].size === "512x512" && sizeOnly.every((variant) => variant.prompt === undefined && variant.count === undefined), JSON.stringify(sizeOnly));

    const variables = await import("/src/lib/canvas/prompt-variables.ts");
    const parsed = variables.parsePromptVariables("{{c }} {{ b }} {{a}} {{ b }}");
    ok("variables parse unique first-seen order", parsed.join(",") === "c,b,a", parsed.join(","));
    ok("variables parse drops empty names", variables.parsePromptVariables("{{  }} {{}} {{ x }}").join(",") === "x", variables.parsePromptVariables("{{  }} {{}} {{ x }}").join(","));
    ok("variables parse tolerates empty input", variables.parsePromptVariables("").length === 0 && variables.parsePromptVariables(undefined).length === 0);
    const applied = variables.applyPromptVariables("a {{name}} b {{ name }} c", [{ name: "name", value: "X" }]);
    ok("variables apply tolerates whitespace", applied === "a X b X c", applied);
    const unmatched = variables.applyPromptVariables("{{known}} {{unknown}}", [{ name: "known", value: "yes" }]);
    ok("variables apply keeps unmatched tokens", unmatched === "yes {{unknown}}", unmatched);
    ok(
        "variables apply unchanged without usable variables",
        variables.applyPromptVariables("{{name}}", undefined) === "{{name}}" && variables.applyPromptVariables("{{name}}", []) === "{{name}}" && variables.applyPromptVariables("{{name}}", [{ name: "  ", value: "x" }]) === "{{name}}",
        variables.applyPromptVariables("{{name}}", undefined),
    );
    const resolvedUnion = variables.resolvePromptVariableList("{{keep}} {{fresh}}", [{ name: "keep", value: "1" }, { name: "extra", value: "2" }]);
    ok("variables resolve unions detected first", JSON.stringify(resolvedUnion) === JSON.stringify([{ name: "keep", value: "1" }, { name: "fresh", value: "" }, { name: "extra", value: "2" }]), JSON.stringify(resolvedUnion));
    const resolvedTrimmed = variables.resolvePromptVariableList("{{ keep }}", [{ name: " keep ", value: "9" }]);
    ok("variables resolve matches trimmed names", JSON.stringify(resolvedTrimmed) === JSON.stringify([{ name: "keep", value: "9" }]), JSON.stringify(resolvedTrimmed));
    const resolvedOrder = variables.resolvePromptVariableList("{{b}} {{a}}", [{ name: "a", value: "1" }, { name: "b", value: "2" }]);
    ok("variables resolve keeps detected order", JSON.stringify(resolvedOrder) === JSON.stringify([{ name: "b", value: "2" }, { name: "a", value: "1" }]), JSON.stringify(resolvedOrder));

    const typography = await import("/src/lib/canvas/text-style.ts");
    ok("text style fontSize clamps to bounds", typography.clampFontSize(2) === typography.TEXT_FONT_SIZE_MIN && typography.clampFontSize(999) === typography.TEXT_FONT_SIZE_MAX, typography.clampFontSize(2) + "," + typography.clampFontSize(999));
    ok("text style fontSize rounds to integer", typography.clampFontSize(17.6) === 18 && typography.clampFontSize(17.4) === 17, typography.clampFontSize(17.6) + "," + typography.clampFontSize(17.4));
    ok("text style fontSize non-finite falls back to default", typography.clampFontSize(Number.NaN) === typography.TEXT_FONT_SIZE_DEFAULT && typography.clampFontSize(Number.POSITIVE_INFINITY) === typography.TEXT_FONT_SIZE_DEFAULT, typography.clampFontSize(Number.NaN));
    ok("text style lineHeight clamps to bounds", typography.clampLineHeight(0.2) === typography.TEXT_LINE_HEIGHT_MIN && typography.clampLineHeight(9) === typography.TEXT_LINE_HEIGHT_MAX, typography.clampLineHeight(0.2) + "," + typography.clampLineHeight(9));
    ok("text style lineHeight rounds to two decimals", typography.clampLineHeight(1.234) === 1.23 && typography.clampLineHeight(1.236) === 1.24, typography.clampLineHeight(1.234) + "," + typography.clampLineHeight(1.236));
    ok("text style lineHeight non-finite falls back to default", typography.clampLineHeight(Number.NaN) === typography.TEXT_LINE_HEIGHT_DEFAULT, typography.clampLineHeight(Number.NaN));
    const textDefaults = typography.resolveTextStyle(undefined);
    ok("text style defaults", textDefaults.fontSize === 14 && textDefaults.lineHeight === 1.65 && textDefaults.bold === false && textDefaults.italic === false && textDefaults.align === "left" && textDefaults.fontFamily === undefined && textDefaults.color === undefined, JSON.stringify(textDefaults));
    const textMapped = typography.resolveTextStyle({ content: "x", fontSize: 24, lineHeight: 2, fontFamily: "Georgia, serif", fontWeight: "bold", italic: true, textAlign: "center", textColor: "#ff0000" });
    ok("text style maps metadata", textMapped.fontSize === 24 && textMapped.lineHeight === 2 && textMapped.fontFamily === "Georgia, serif" && textMapped.bold === true && textMapped.italic === true && textMapped.align === "center" && textMapped.color === "#ff0000", JSON.stringify(textMapped));
    const textUnknown = typography.resolveTextStyle({ textAlign: "diagonal", fontWeight: "heavy", italic: "yes", fontFamily: "  ", textColor: " ", fontSize: Number.NaN, lineHeight: -4 });
    ok("text style unknown values fall back", textUnknown.align === "left" && textUnknown.bold === false && textUnknown.italic === false && textUnknown.fontFamily === undefined && textUnknown.color === undefined && textUnknown.fontSize === 14 && textUnknown.lineHeight === 1, JSON.stringify(textUnknown));
    const textCssDefault = typography.textStyleToCss(textDefaults);
    ok("text style css omits optional colour and font family", textCssDefault.color === undefined && textCssDefault.fontFamily === undefined && textCssDefault.fontSize === "14px" && textCssDefault.lineHeight === 1.65 && textCssDefault.fontWeight === "normal" && textCssDefault.fontStyle === "normal" && textCssDefault.textAlign === "left", JSON.stringify(textCssDefault));
    const textCssMapped = typography.textStyleToCss(textMapped);
    ok("text style css writes mapped values", textCssMapped.color === "#ff0000" && textCssMapped.fontFamily === "Georgia, serif" && textCssMapped.fontSize === "24px" && textCssMapped.lineHeight === 2 && textCssMapped.fontWeight === "bold" && textCssMapped.fontStyle === "italic" && textCssMapped.textAlign === "center", JSON.stringify(textCssMapped));
    ok("text style offers font family stacks", typography.TEXT_FONT_FAMILIES.length >= 4 && typography.TEXT_FONT_FAMILIES.every((item) => item.label && item.value && !item.value.includes(";")), JSON.stringify(typography.TEXT_FONT_FAMILIES));

    const agentOps = await import("/src/lib/canvas/canvas-agent-ops.ts");
    const flaggedNode = { id: "flag", type: "image", title: "flag", position: { x: 0, y: 0 }, width: 100, height: 100, metadata: { groupId: "g1", status: "idle" } };
    const clearedNode = agentOps.applyCanvasAgentOps(
        { projectId: "p", title: "p", nodes: [flaggedNode], connections: [], selectedNodeIds: [], viewport: { x: 0, y: 0, k: 1 } },
        [{ type: "update_node", id: "flag", metadata: { groupId: null, status: "idle" } }],
    );
    ok("agent update_node drops explicit null metadata keys", clearedNode.nodes[0].metadata.groupId === undefined && !("groupId" in clearedNode.nodes[0].metadata) && clearedNode.nodes[0].metadata.status === "idle", JSON.stringify(clearedNode.nodes[0].metadata));

    const permissions = await import("/src/lib/canvas/agent-permissions.ts");
    const allowedOps = [{ type: "add_node" }, { type: "delete_node", id: "n1" }];
    const allAllowed = permissions.filterPermittedOps(allowedOps, permissions.DEFAULT_AGENT_PERMISSIONS);
    ok("agent permissions default allows every op", allAllowed.permitted.length === 2 && allAllowed.blocked.length === 0, JSON.stringify(allAllowed));
    const denied = permissions.filterPermittedOps(allowedOps, { ...permissions.DEFAULT_AGENT_PERMISSIONS, delete_node: false });
    ok("agent permissions deny blocks matching type", denied.permitted.length === 1 && denied.permitted[0].type === "add_node" && denied.blocked.length === 1 && denied.blocked[0].type === "delete_node", JSON.stringify(denied));
    const missingKey = permissions.filterPermittedOps([{ type: "arrange_board", id: "b1" }], {});
    ok("agent permissions missing key stays permitted", missingKey.permitted.length === 1 && missingKey.blocked.length === 0, JSON.stringify(missingKey));
    const noOps = permissions.filterPermittedOps(undefined, permissions.DEFAULT_AGENT_PERMISSIONS);
    ok("agent permissions undefined ops yield nothing", noOps.permitted.length === 0 && noOps.blocked.length === 0, JSON.stringify(noOps));
    ok(
        "agent permissions default covers every op type",
        permissions.AGENT_OP_TYPES.length === 10 && permissions.AGENT_OP_TYPES.every((type) => permissions.DEFAULT_AGENT_PERMISSIONS[type] === true),
        permissions.AGENT_OP_TYPES.join(","),
    );
    ok(
        "agent op describe add_node",
        permissions.describeAgentOp({ type: "add_node", id: "n1" }) === "add_node n1" && permissions.describeAgentOp({ type: "add_node", nodeType: "image" }) === "add_node image",
        permissions.describeAgentOp({ type: "add_node", nodeType: "image" }),
    );
    ok(
        "agent op describe connect_nodes and run_generation",
        permissions.describeAgentOp({ type: "connect_nodes", fromNodeId: "a", toNodeId: "b" }) === "connect_nodes a->b" &&
            permissions.describeAgentOp({ type: "run_generation", nodeId: "n1" }) === "run_generation n1 image",
        permissions.describeAgentOp({ type: "connect_nodes", fromNodeId: "a", toNodeId: "b" }),
    );

    const output = await import("/src/lib/canvas/output-resolution.ts");
    const outNode = (id, type, title) => ({ id, type, title, position: { x: 0, y: 0 }, width: 340, height: 240, metadata: {} });
    const outNodes = [outNode("a", "text", "A"), outNode("b", "image", "B"), outNode("c", "text", "C")];
    const outConns = [
        { id: "c1", fromNodeId: "a", toNodeId: "out" },
        { id: "c2", fromNodeId: "b", toNodeId: "out" },
        { id: "c3", fromNodeId: "c", toNodeId: "out" },
    ];
    ok("output newest upstream wins", output.resolveLatestUpstream("out", outNodes, outConns, { a: 10, b: 30, c: 20 })?.id === "b", output.resolveLatestUpstream("out", outNodes, outConns, { a: 10, b: 30, c: 20 })?.id);
    ok("output ties fall back to last connection", output.resolveLatestUpstream("out", outNodes, outConns, { a: 5, b: 5, c: 5 })?.id === "c", output.resolveLatestUpstream("out", outNodes, outConns, { a: 5, b: 5, c: 5 })?.id);
    ok("output missing timestamps fall back to last connection", output.resolveLatestUpstream("out", outNodes, outConns)?.id === "c", output.resolveLatestUpstream("out", outNodes, outConns)?.id);
    ok("output undefined timestamps keep the timestamped newest", output.resolveLatestUpstream("out", outNodes, outConns, { b: 7 })?.id === "b", output.resolveLatestUpstream("out", outNodes, outConns, { b: 7 })?.id);
    ok("output no upstream is null", output.resolveLatestUpstream("out", outNodes, []) === null);
    ok("output unknown target is null", output.resolveLatestUpstream("missing", outNodes, outConns) === null);
    const firstOutput = outNode("o1", "output", "Out 1");
    const secondOutput = outNode("o2", "output", "Out 2");
    ok("output default is the first output", output.pickDefaultOutput([outNodes[0], firstOutput, secondOutput, outNodes[1]])?.id === "o1" && output.pickDefaultOutput([outNodes[0]]) === null);
    ok("output conflict only with multiple outputs", output.outputNodesConflict([firstOutput, secondOutput]) === true && output.outputNodesConflict([firstOutput, outNodes[0]]) === false && output.outputNodesConflict([]) === false);
    ok("output describe source label", output.describeOutputSource(firstOutput) === "Out 1" && output.describeOutputSource(outNode("x", "text", "   ")) === "Untitled" && output.describeOutputSource(null) === "");

    const workspace = await import("/src/lib/workspace/workspace-sync.ts");
    ok("workspace file name keeps a safe title", workspace.workspaceFileName("id1", "Hello World") === "Hello World.json", workspace.workspaceFileName("id1", "Hello World"));
    ok("workspace file name strips path-illegal characters", workspace.workspaceFileName("id1", 'a/b:c*d?e"f<g>h|i') === "abcdefghi.json", workspace.workspaceFileName("id1", 'a/b:c*d?e"f<g>h|i'));
    ok("workspace file name falls back to the id", workspace.workspaceFileName("id1", "   ") === "id1.json", workspace.workspaceFileName("id1", "   "));
    ok("workspace file name stays short", workspace.workspaceFileName("id1", "x".repeat(100)) === "x".repeat(48) + ".json", workspace.workspaceFileName("id1", "x".repeat(100)));
    ok("conflict file name inserts the suffix", workspace.conflictFileName("foo.json") === "foo_conflict.json", workspace.conflictFileName("foo.json"));
    ok("conflict file name dedupes with -2", workspace.conflictFileName("foo.json", ["foo_conflict.json"]) === "foo_conflict-2.json", workspace.conflictFileName("foo.json", ["foo_conflict.json"]));
    ok("conflict file name dedupes with -3", workspace.conflictFileName("foo.json", ["foo_conflict.json", "foo_conflict-2.json"]) === "foo_conflict-3.json", workspace.conflictFileName("foo.json", ["foo_conflict.json", "foo_conflict-2.json"]));
    ok("conflict file name keeps extensionless names", workspace.conflictFileName("foo") === "foo_conflict", workspace.conflictFileName("foo"));
    ok("decide sync uploads a local-only project", workspace.decideSyncAction({ localMtime: 5 }) === "upload", workspace.decideSyncAction({ localMtime: 5 }));
    ok("decide sync downloads a remote-only project", workspace.decideSyncAction({ remoteMtime: 5 }) === "download", workspace.decideSyncAction({ remoteMtime: 5 }));
    ok("decide sync noops on untouched sides", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 5, lastSyncedAt: 5 }) === "noop", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 5, lastSyncedAt: 5 }));
    ok("decide sync downloads when only remote changed", workspace.decideSyncAction({ localMtime: 2, remoteMtime: 5, lastSyncedAt: 3 }) === "download", workspace.decideSyncAction({ localMtime: 2, remoteMtime: 5, lastSyncedAt: 3 }));
    ok("decide sync uploads when only local changed", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 2, lastSyncedAt: 3 }) === "upload", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 2, lastSyncedAt: 3 }));
    ok("decide sync conflicts when both changed", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 5, lastSyncedAt: 3 }) === "conflict", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 5, lastSyncedAt: 3 }));
    ok("decide sync conflicts without a baseline", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 5 }) === "conflict", workspace.decideSyncAction({ localMtime: 5, remoteMtime: 5 }));
    ok("decide sync noops with nothing on either side", workspace.decideSyncAction({}) === "noop", workspace.decideSyncAction({}));
    const workspacePlan = workspace.planWorkspaceSync({
        projects: [{ id: "p1", title: "Alpha", updatedAt: 5 }, { id: "p2", title: "Beta", updatedAt: 5 }],
        files: [{ name: "Alpha.json", mtime: 1 }, { name: "Orphan.json", mtime: 9 }],
        lastSyncedAt: { p1: 5 },
    });
    ok("plan workspace orders projects then remote-only files", workspacePlan.map((item) => item.action).join(",") === "noop,upload,download", workspacePlan.map((item) => item.action).join(","));
    ok("plan workspace maps project file names", workspacePlan[0].fileName === "Alpha.json" && workspacePlan[1].fileName === "Beta.json", workspacePlan.map((item) => item.fileName).join(","));
    ok("plan workspace appends remote-only files last", workspacePlan.length === 3 && workspacePlan[2].projectId === "" && workspacePlan[2].fileName === "Orphan.json", JSON.stringify(workspacePlan[2]));

    const algorithms = await import("/src/lib/image/image-algorithms.ts");
    const cropClamped = algorithms.resolveSmartCropArea(100, 80, 1, { x: -5, y: -3, width: 200, height: 200 });
    ok("smart crop clamps into image bounds", cropClamped.x === 0 && cropClamped.y === 0 && cropClamped.width === 100 && cropClamped.height === 80, JSON.stringify(cropClamped));
    const cropRounded = algorithms.resolveSmartCropArea(101, 80, 1, { x: 1.4, y: 2.6, width: 30.5, height: 20.2 });
    ok("smart crop rounds to integers", cropRounded.x === 1 && cropRounded.y === 3 && cropRounded.width === 31 && cropRounded.height === 20, JSON.stringify(cropRounded));
    const cropInvalid = algorithms.resolveSmartCropArea(120, 90, 0, { x: 5, y: 5, width: 20, height: 20 });
    ok("smart crop falls back to the full image on invalid aspect", cropInvalid.x === 0 && cropInvalid.y === 0 && cropInvalid.width === 120 && cropInvalid.height === 90, JSON.stringify(cropInvalid));
    const cropInside = algorithms.resolveSmartCropArea(64, 48, 1.5, { x: 50, y: 40, width: 40, height: 30 });
    ok("smart crop keeps the box inside the image", cropInside.x + cropInside.width <= 64 && cropInside.y + cropInside.height <= 48 && cropInside.width >= 1 && cropInside.height >= 1, JSON.stringify(cropInside));

    const ocr = await import("/src/lib/canvas/canvas-ocr.ts");
    ok("ocr trims surrounding whitespace", ocr.normaliseOcrText("  hello \\n\\n") === "hello", JSON.stringify(ocr.normaliseOcrText("  hello \\n\\n")));
    ok("ocr strips wrapping code fences", ocr.normaliseOcrText("\`\`\`text\\nline 1\\nline 2\\n\`\`\`") === "line 1\\nline 2", JSON.stringify(ocr.normaliseOcrText("\`\`\`text\\nline 1\\nline 2\\n\`\`\`")));
    ok("ocr strips trailing whitespace per line", ocr.normaliseOcrText("a  \\nb\\t\\nc") === "a\\nb\\nc", JSON.stringify(ocr.normaliseOcrText("a  \\nb\\t\\nc")));
    ok("ocr keeps inner blank lines and spacing", ocr.normaliseOcrText("a b\\n\\nc") === "a b\\n\\nc", JSON.stringify(ocr.normaliseOcrText("a b\\n\\nc")));
    ok("ocr normalises blank input", ocr.normaliseOcrText("   ") === "", JSON.stringify(ocr.normaliseOcrText("   ")));
    ok("ocr exposes extractImageText", typeof ocr.extractImageText === "function");

    const modelStore = await import("/src/stores/use-local-model-store.ts");
    const localModels = modelStore.listLocalModels();
    ok("local model registry lists background-removal", localModels.some((model) => model.id === "background-removal"), JSON.stringify(localModels.map((model) => model.id)));
    ok("local model descriptor exposes title/description/prepare/clear/read", localModels.every((model) => typeof model.titleKey === "string" && typeof model.descriptionKey === "string" && typeof model.prepare === "function" && typeof model.clear === "function" && typeof model.read === "function"), JSON.stringify(localModels.map((model) => Object.keys(model))));

    return results;
})()`;

function connect(wsUrl) {
    return new Promise((resolvePromise, rejectPromise) => {
        const socket = new WebSocket(wsUrl);
        socket.addEventListener("open", () => resolvePromise(socket));
        socket.addEventListener("error", () => rejectPromise(new Error("CDP socket error")));
    });
}

async function send(socket, id, method, params) {
    socket.send(JSON.stringify({ id, method, params }));
    while (true) {
        const message = await new Promise((resolvePromise) => socket.addEventListener("message", (event) => resolvePromise(event), { once: true }));
        const payload = JSON.parse(typeof message.data === "string" ? message.data : String(message.data));
        if (payload.id === id) return payload.result;
    }
}

async function main() {
    if (!CHROME) throw new Error("Chrome not found on this machine");
    try {
        const health = await fetch(`${BASE}/health`);
        if (!health.ok) throw new Error(String(health.status));
    } catch {
        throw new Error(`Dev server is not reachable at ${BASE} — start it before running the E2E suite`);
    }

    mkdirSync(ARTIFACTS, { recursive: true });
    const profile = join(tmpdir(), `opencanvas-e2e-${process.pid}`);
    rmSync(profile, { recursive: true, force: true });
    const child = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=1500,950", `${BASE}/canvas`], { stdio: "ignore" });

    let targets = [];
    for (let attempt = 0; attempt < 40; attempt++) {
        await delay(500);
        try {
            targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            if (targets.some((target) => target.type === "page" && target.webSocketDebuggerUrl)) break;
        } catch {}
    }
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page) throw new Error("Could not attach to a Chrome page target");

    const socket = await connect(page.webSocketDebuggerUrl);
    let nextId = 1;
    await send(socket, nextId++, "Runtime.enable", {});
    await send(socket, nextId++, "Page.enable", {});
    await delay(3000);

    const consoleErrors = [];
    socket.addEventListener("message", (event) => {
        const payload = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
        if (payload.method === "Runtime.exceptionThrown") consoleErrors.push(payload.params.exceptionDetails?.text || "exception");
        if (payload.method === "Runtime.consoleAPICalled" && payload.params.type === "error") consoleErrors.push("console.error");
    });

    const evaluated = await send(socket, nextId++, "Runtime.evaluate", { expression: LIB_ASSERTIONS, awaitPromise: true, returnByValue: true });
    const raw = evaluated?.result?.value;
    const results = Array.isArray(raw) ? raw : [];
    if (!Array.isArray(raw)) {
        const detail = evaluated?.exceptionDetails?.exception?.description || evaluated?.exceptionDetails?.text || JSON.stringify(evaluated);
        console.log(`in-page assertion error: ${String(detail).split("\n").slice(0, 6).join(" | ")}`);
    }
    const screenshot = await send(socket, nextId++, "Page.captureScreenshot", { format: "png" });
    if (screenshot?.data) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(join(ARTIFACTS, "canvas.png"), Buffer.from(screenshot.data, "base64"));
    }
    socket.close();
    child.kill();

    let failed = 0;
    for (const result of results) {
        if (result.pass) console.log(`  PASS  ${result.name}`);
        else {
            failed += 1;
            console.log(`  FAIL  ${result.name}  ->  ${result.detail}`);
        }
    }
    console.log(`\n${results.length - failed}/${results.length} library assertions passed`);
    console.log(`console errors during run: ${consoleErrors.length}`);
    console.log(`artifacts: ${ARTIFACTS}`);
    if (!results.length) {
        console.log(`no assertions ran: ${JSON.stringify(evaluated).slice(0, 400)}`);
        process.exitCode = 1;
        return;
    }
    process.exitCode = failed || consoleErrors.length ? 1 : 0;
}

main().catch((error) => {
    console.error(`E2E failed: ${error.message}`);
    process.exit(1);
});

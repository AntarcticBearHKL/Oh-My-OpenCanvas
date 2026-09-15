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

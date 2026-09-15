import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import { Download, ImagePlus, LayoutDashboard, LayoutGrid, Type } from "lucide-react";

import { requestEdit, requestGeneration, requestImageQuestion } from "@/services/api/image";
import { requestAudioGeneration, storeGeneratedAudio } from "@/services/api/audio";
import { createVideoGenerationTask, isVideoTaskFailed, storeGeneratedVideo, waitForVideoGenerationTask } from "@/services/api/video";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useLocalModelStore } from "@/stores/use-local-model-store";
import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { removeImageBackground } from "@/services/background-removal";
import { uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { nanoid } from "nanoid";
import { getDataUrlByteSize } from "@/lib/image-utils";
import { canvasThemes, frostedSurfaceClass } from "@/lib/canvas-theme";
import { useAssetStore } from "@/stores/use-asset-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { cropDataUrl, splitDataUrl, upscaleDataUrl, type ImageUpscaleParams } from "@/lib/canvas/canvas-image-data";
import { fitNodeSize } from "@/lib/canvas/canvas-node-size";
import { captureVideoFrame, type VideoFramePosition } from "@/lib/canvas/canvas-video-frame";
import { App, Button, Dropdown, Modal } from "antd";
import { NODE_DEFAULT_SIZE, getNodeSpec } from "@/constant/canvas";
import { ActiveConnectionPath, ConnectionPath } from "@/components/canvas/canvas-connections";
import { CanvasConfigComposer } from "@/components/canvas/canvas-config-composer";
import { CanvasConfigNodePanel } from "@/components/canvas/canvas-config-node-panel";
import { AssetsNodeContent } from "@/components/canvas/nodes/assets-node-content";
import { CanvasImageAnalysisDialog } from "@/components/canvas/canvas-image-analysis-dialog";
import { CanvasNodeAngleDialog } from "@/components/canvas/canvas-node-angle-dialog";
import { CanvasNodeCropDialog, type CanvasImageCropRect } from "@/components/canvas/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog } from "@/components/canvas/canvas-node-mask-edit-dialog";
import { CanvasNodeSplitDialog, type CanvasImageSplitParams } from "@/components/canvas/canvas-node-split-dialog";
import { CanvasNodeResolutionDialog, type CanvasImageResolutionPayload } from "@/components/canvas/canvas-node-resolution-dialog";
import { CanvasNodeSegmentDialog, type CanvasImageSegmentResult } from "@/components/canvas/canvas-node-segment-dialog";
import { buildNodeGenerationInputs, type NodeGenerationInput } from "@/components/canvas/canvas-node-generation";
import { CanvasNodeHoverToolbar, CanvasNodeInfoModal } from "@/components/canvas/canvas-node-hover-toolbar";
import { CanvasNodeListPanel } from "@/components/canvas/canvas-node-layer-popover";
import { CanvasRulers } from "@/components/canvas/canvas-rulers";
import { CanvasSelectionToolbar } from "@/components/canvas/canvas-selection-toolbar";
import { alignNodes, type AlignAxis } from "@/lib/canvas/alignment";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import { Minimap } from "@/components/canvas/canvas-mini-map";
import { CanvasNode, selectionBlue } from "@/components/canvas/canvas-node";
import { CanvasNodePromptPanel, type CanvasNodeGenerationMode } from "@/components/canvas/canvas-node-prompt-panel";
import { PromptNodePanel } from "@/components/canvas/prompt-node-panel";
import { SmartCanvasSettingsPopover } from "@/components/canvas/smart-canvas-settings-popover";
import { SmartCanvasLayerPopover } from "@/components/canvas/smart-canvas-layer-popover";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { AssetPickerModal } from "@/components/canvas/asset-picker-modal";
import { CanvasSidePanel } from "@/components/canvas/canvas-side-panel";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useAgentBridge } from "@/pages/canvas/hooks/use-agent-bridge";
import { usePluginHost } from "@/pages/canvas/hooks/use-plugin-host";
import { useCanvasGeneration } from "@/pages/canvas/hooks/use-canvas-generation";
import { useCanvasInsertion } from "@/pages/canvas/hooks/use-canvas-insertion";
import { useCanvasHistory } from "@/pages/canvas/hooks/use-canvas-history";
import { useCanvasDocument } from "@/pages/canvas/hooks/use-canvas-document";
import { NODE_STATUS_SUCCESS, VIDEO_NODE_MAX_HEIGHT, VIDEO_NODE_MAX_WIDTH } from "@/lib/canvas/canvas-node-constants";
import { buildNodeMentionReferences, isCanvasReferenceNode, type CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import { applyNodeConfigPatch, createCanvasNode } from "@/lib/canvas/canvas-node-factory";
import { insertDerivedAsset } from "@/lib/canvas/canvas-derived-asset";
import { extractImageText, ocrPrompt } from "@/lib/canvas/canvas-ocr";
import { arrangeBoardImages, BOARD_LAYOUT_TEMPLATES, boardLayerImageIds, composeSmartCanvas, moveBoardLayer, orderBoardImages, SMART_CANVAS_DEFAULT_FONT_SIZE, smartCanvasBackground, smartCanvasSizeForRatio, smartCanvasTexts, type BoardLayoutTemplate } from "@/lib/canvas/smart-canvas";
import { CANVAS_GRID_SIZE, bulkRenameTitles, findBoardDropTarget, getConnectionTargetAnchor, isNodeHidden, isNodeLocked, nodeBounds, nodeCenterInside, normalizeConnection, snapDragToGuides } from "@/lib/canvas/canvas-node-geometry";
import {
    audioExtension,
    buildGenerationConfig,
    getGenerationCount,
    getInputSummary,
    hasResumableVideoTask,
    hydrateAssistantImages,
    hydrateCanvasImages,
    imageExtension,
    resetInterruptedGeneration,
} from "@/lib/canvas/canvas-generation-helpers";
import { getNodeDefinition, useNodeRegistryVersion } from "@/lib/canvas/node-registry";
import { resolveLatestUpstream } from "@/lib/canvas/output-resolution";
import { outputFileName, outputSourceFingerprint, resolveOutputBlob } from "@/lib/workspace/output-file";
import { useAssetFolderStore } from "@/stores/use-asset-folder-store";
import { useCanvasSidePanelStore } from "@/stores/use-canvas-side-panel-store";
import { registerBuiltinNodes } from "@/components/canvas/nodes/builtin-nodes";
import { CanvasPluginManagerModal } from "@/components/canvas/canvas-plugin-manager-modal";
import { CanvasRefreshShell } from "@/components/canvas/canvas-refresh-shell";
import { CanvasTopBar } from "@/components/canvas/canvas-top-bar";
import { ConnectionCreateMenu, type PendingConnectionCreate } from "@/components/canvas/canvas-create-menus";
import {
    CanvasNodeType,
    type CanvasAssistantSession,
    type CanvasConnection,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type ConnectionHandle,
    type Position,
    type SelectionBox,
    type ViewportTransform,
} from "@/types/canvas";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

// Register built-in nodes in the shared registry once when the module loads.
registerBuiltinNodes();

// Stable empty reference array prevents `... || []` from invalidating CanvasNode's React.memo on every render.
const EMPTY_REFERENCES: CanvasResourceReference[] = [];
const CONNECTION_HANDLE_HIT_RADIUS = 40;
const CONNECTION_NODE_HIT_PADDING = 32;
const EMPTY_SNAP_GUIDES = { x: [], y: [] };
const BOARD_LAYOUT_LABEL_KEYS: Record<BoardLayoutTemplate, string> = {
    grid: "canvas.smartCanvas.layoutGrid",
    row: "canvas.smartCanvas.layoutRow",
    column: "canvas.smartCanvas.layoutColumn",
    feature: "canvas.smartCanvas.layoutFeature",
};

type CanvasClipboard = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
};

type ConnectionDropTarget = {
    nodeId: string | null;
    isNearNode: boolean;
};





export default function CanvasPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <CanvasRefreshShell />;

    return <InfiniteCanvasPage />;
}

function InfiniteCanvasPage() {
    const { message, modal } = App.useApp();
    const { t } = useTranslation();
    // Subscribe to the registry version so plugin registration changes rerender the canvas.
    const nodeRegistryVersion = useNodeRegistryVersion((state) => state.version);
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();
    const projectId = params.id || "";
    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<{ nodeId?: string; position?: Position } | null>(null);
    const clipboardRef = useRef<CanvasClipboard | null>(null);
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didInitialCenterRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const dragMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const nodeDraggingRef = useRef(false);
    const dragRef = useRef<{
        isDraggingNode: boolean;
        hasMoved: boolean;
        startX: number;
        startY: number;
        initialSelectedNodes: { id: string; x: number; y: number }[];
    }>({
        isDraggingNode: false,
        hasMoved: false,
        startX: 0,
        startY: 0,
        initialSelectedNodes: [],
    });

    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const prepareModel = useLocalModelStore((state) => state.prepareModel);
    const addAsset = useAssetStore((state) => state.addAsset);
    const cleanupAssetImages = useAssetStore((state) => state.cleanupImages);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const openProject = useCanvasStore((state) => state.openProject);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const currentProject = useCanvasStore((state) => state.projects.find((project) => project.id === projectId));
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const outputFolderName = useAssetFolderStore((state) => state.outputFolderName);
    const panelOpen = useCanvasSidePanelStore((state) => state.panelOpen);
    const outputWriteFingerprints = useRef(new Map<string, string>());
    const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
    const [connections, setConnections] = useState<CanvasConnection[]>([]);
    const [chatSessions, setChatSessions] = useState<CanvasAssistantSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [canvasTool, setCanvasTool] = useState<"select" | "pan">("pan");
    const [size, setSize] = useState({ width: 1200, height: 720 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [connectingParams, setConnectingParams] = useState<ConnectionHandle | null>(null);
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string | null>(null);
    const [pendingConnectionCreate, setPendingConnectionCreate] = useState<PendingConnectionCreate | null>(null);
    const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
    const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [projectLoaded, setProjectLoaded] = useState(false);
    const loadedOnceRef = useRef(false);
    const [toolbarNodeId, setToolbarNodeId] = useState<string | null>(null);
    const [nodeImageSettingsOpen, setNodeImageSettingsOpen] = useState(false);
    const [dialogNodeId, setDialogNodeId] = useState<string | null>(null);
    const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
    const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
    const [cropNodeId, setCropNodeId] = useState<string | null>(null);
    const [maskEditNodeId, setMaskEditNodeId] = useState<string | null>(null);
    const [splitNodeId, setSplitNodeId] = useState<string | null>(null);
    const [resolutionNodeId, setResolutionNodeId] = useState<string | null>(null);
    const [analyzeNodeId, setAnalyzeNodeId] = useState<string | null>(null);
    const [segmentNodeId, setSegmentNodeId] = useState<string | null>(null);
    const [angleNodeId, setAngleNodeId] = useState<string | null>(null);
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
    const [previewImageId, setPreviewImageId] = useState<string | null>(null);
    const [titleEditing, setTitleEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");
    const [expandedBatchNodeIds, setExpandedBatchNodeIds] = useState<Set<string>>(new Set());
    const [isNodeDragging, setIsNodeDragging] = useState(false);
    const [isNodeResizing, setIsNodeResizing] = useState(false);
    const [dropTargetBoardId, setDropTargetBoardId] = useState<string | null>(null);
    const [snapGuides, setSnapGuides] = useState<{ x: number[]; y: number[] }>(EMPTY_SNAP_GUIDES);
    const [dragPreview, setDragPreview] = useState<Map<string, Position> | null>(null);
    const [referencePickerNodeId, setReferencePickerNodeId] = useState<string | null>(null);
    const [boardPreview, setBoardPreview] = useState<{ dataUrl: string; width: number; height: number; title: string; boardId: string } | null>(null);
    const [isNodeListOpen, setIsNodeListOpen] = useState(false);
    const [nodeUpdatedAt, setNodeUpdatedAt] = useState<Record<string, number>>({});

    const nodesRef = useRef(nodes);
    const connectionsRef = useRef(connections);
    const selectedNodeIdsRef = useRef(selectedNodeIds);
    const viewportRef = useRef(viewport);
    const generateNodeRef = useRef<((nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => Promise<void>) | null>(null);
    const connectingParamsRef = useRef(connectingParams);
    const connectionTargetNodeIdRef = useRef(connectionTargetNodeId);
    const selectionBoxRef = useRef(selectionBox);
    const pendingConnectionCreateRef = useRef(pendingConnectionCreate);
    const nodeSnapshotsRef = useRef<Map<string, string> | null>(null);

    useEffect(() => {
        const now = Date.now();
        const snapshots = new Map(nodes.map((node) => [node.id, JSON.stringify(node)]));
        const previous = nodeSnapshotsRef.current;
        nodeSnapshotsRef.current = snapshots;
        if (!previous) {
            setNodeUpdatedAt(Object.fromEntries(nodes.map((node) => [node.id, now])));
            return;
        }
        const changed: Record<string, number> = {};
        snapshots.forEach((snapshot, id) => {
            if (previous.get(id) === snapshot) return;
            changed[id] = now;
        });
        if (Object.keys(changed).length) setNodeUpdatedAt((current) => ({ ...current, ...changed }));
    }, [nodes]);

    const { historyState, undoCanvas, redoCanvas, resetHistory, historyRef, lastHistoryRef, historyPausedRef } = useCanvasHistory({
        nodes,
        connections,
        chatSessions,
        activeChatId,
        projectLoaded,
        nodesRef,
        connectionsRef,
        setNodes,
        setConnections,
        setChatSessions,
        setActiveChatId,
        setSelectedNodeIds,
        setSelectedConnectionId,
    });

    const cleanupCanvasFiles = useCallback(
        (extra?: unknown) => {
            cleanupAssetImages({ extra, history: historyRef.current, lastHistory: lastHistoryRef.current });
        },
        [cleanupAssetImages],
    );

    const { handleGenerateNode, handleGenerateMatrix, handleRetryNode, handleReplayNode, pollVideoNodeTask, confirmStopGeneration, maskEditImageNode, generateAngleNode } = useCanvasGeneration({
        effectiveConfig,
        isAiConfigReady,
        openConfigDialog,
        message,
        modal,
        t,
        nodesRef,
        connectionsRef,
        setNodes,
        setConnections,
        setSelectedNodeIds,
        setSelectedConnectionId,
        setDialogNodeId,
        setRunningNodeId,
        setMaskEditNodeId,
        setAngleNodeId,
        setExpandedBatchNodeIds,
    });

    useEffect(() => {
        if (!hydrated) return;
        if (loadedOnceRef.current) {
            setNodes([]);
            setConnections([]);
        }
        setProjectLoaded(false);
        const project = openProject(projectId);
        if (!project) {
            navigate("/canvas", { replace: true });
            return;
        }

        const restore = async () => {
            const restoredNodes = await hydrateCanvasImages(resetInterruptedGeneration(project.nodes));
            const restoredSessions = await hydrateAssistantImages(project.chatSessions || []);
            setNodes(restoredNodes);
            setConnections(project.connections);
            setChatSessions(restoredSessions);
            setActiveChatId(project.activeChatId || null);
            setViewport(project.viewport);
            resetHistory({ nodes: restoredNodes, connections: project.connections, chatSessions: restoredSessions, activeChatId: project.activeChatId || null });
            loadedOnceRef.current = true;
            setProjectLoaded(true);
        };
        void restore();
    }, [hydrated, navigate, openProject, projectId]);

    useEffect(() => {
        if (!projectLoaded) return;
        nodesRef.current.filter(hasResumableVideoTask).forEach((node) => void pollVideoNodeTask(node, true));
        // Resume once after the current canvas is restored, not on later config identity changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectLoaded]);


    useEffect(() => {
        if (!projectLoaded || historyPausedRef.current) return;
        updateProject(projectId, { nodes, connections, chatSessions, activeChatId });
    }, [activeChatId, chatSessions, connections, nodes, projectId, projectLoaded, updateProject]);

    useEffect(() => {
        if (!dialogNodeId) setNodeImageSettingsOpen(false);
    }, [dialogNodeId]);

    useEffect(() => {
        if (!projectLoaded) return;
        if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { viewport: viewportRef.current });
            viewportSaveTimerRef.current = null;
        }, 500);
        return () => {
            if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        };
    }, [projectId, projectLoaded, updateProject, viewport]);

    useLayoutEffect(() => {
        nodesRef.current = nodes;
        connectionsRef.current = connections;
        selectedNodeIdsRef.current = selectedNodeIds;
        viewportRef.current = viewport;
        connectingParamsRef.current = connectingParams;
        connectionTargetNodeIdRef.current = connectionTargetNodeId;
        pendingConnectionCreateRef.current = pendingConnectionCreate;
    }, [nodes, connections, selectedNodeIds, viewport, connectingParams, connectionTargetNodeId, pendingConnectionCreate]);

    useLayoutEffect(() => {
        selectionBoxRef.current = selectionBox;
    }, [selectionBox]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
            if (!didInitialCenterRef.current) {
                didInitialCenterRef.current = true;
                setViewport({ x: rect.width / 2, y: rect.height / 2, k: 1 });
            }
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(el);
        return () => resizeObserver.disconnect();
    }, [panelOpen, projectLoaded]);

    const screenToCanvas = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const currentViewport = viewportRef.current;
        const localX = clientX - (rect?.left || 0);
        const localY = clientY - (rect?.top || 0);

        return {
            x: (localX - currentViewport.x) / currentViewport.k,
            y: (localY - currentViewport.y) / currentViewport.k,
        };
    }, []);

    const getCanvasCenter = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        return screenToCanvas((rect?.left || 0) + (rect?.width || size.width) / 2, (rect?.top || 0) + (rect?.height || size.height) / 2);
    }, [screenToCanvas, size.height, size.width]);

    const setConnecting = useCallback((next: ConnectionHandle | null) => {
        connectingParamsRef.current = next;
        setConnectingParams(next);
        if (!next) {
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
        }
    }, []);

    const keepNodeToolbar = useCallback(
        (nodeId: string) => {
            if (nodeDraggingRef.current || nodeImageSettingsOpen || !selectedNodeIdsRef.current.has(nodeId)) return;
            setToolbarNodeId(nodeId);
        },
        [nodeImageSettingsOpen],
    );

    const hideNodeToolbar = useCallback(() => {}, []);

    const connectNodes = useCallback(
        (current: ConnectionHandle, targetNodeId: string) => {
            if (current.nodeId === targetNodeId) return;

            const connection = normalizeConnection(current.nodeId, targetNodeId, nodesRef.current, current.handleType);
            if (!connection) {
                message.warning(t("canvas.projectPage.configConnection"));
                return;
            }
            const { fromNodeId, toNodeId } = connection;
            const exists = connectionsRef.current.some((conn) => conn.fromNodeId === fromNodeId && conn.toNodeId === toNodeId);
            if (!exists) {
                setConnections((prev) => [...prev, { id: `conn-${Date.now()}`, fromNodeId, toNodeId }]);
            }
        },
        [message, t],
    );

    const createConnectedNode = useCallback(
        (type: CanvasNodeType.Image | CanvasNodeType.Text | CanvasNodeType.Config | CanvasNodeType.Video | CanvasNodeType.Audio, pending: PendingConnectionCreate) => {
            const metadata = type === CanvasNodeType.Config ? { model: effectiveConfig.imageModel || effectiveConfig.model, size: effectiveConfig.size, count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count) } : undefined;
            const newNode = createCanvasNode(type, pending.position, metadata);
            const connection = normalizeConnection(pending.connection.nodeId, newNode.id, [...nodesRef.current, newNode], pending.connection.handleType);
            if (!connection) {
                message.warning(t("canvas.projectPage.configConnection"));
                return;
            }
            setNodes((prev) => [...prev, newNode]);
            setConnections((prev) => [...prev, { id: nanoid(), ...connection }]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Text && type !== CanvasNodeType.Audio) setDialogNodeId(newNode.id);
            setPendingConnectionCreate(null);
            setConnecting(null);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message, setConnecting, t],
    );

    const cancelPendingConnectionCreate = useCallback(() => {
        setPendingConnectionCreate(null);
        setConnecting(null);
    }, [setConnecting]);

    const getConnectionDropTarget = useCallback(
        (clientX: number, clientY: number, current: ConnectionHandle): ConnectionDropTarget => {
            const world = screenToCanvas(clientX, clientY);
            const scale = Math.max(viewportRef.current.k, 0.05);
            const padding = CONNECTION_NODE_HIT_PADDING / scale;
            const handleRadius = CONNECTION_HANDLE_HIT_RADIUS / scale;
            let isNearNode = false;
            let bestNodeId: string | null = null;
            let bestPriority = Number.POSITIVE_INFINITY;

            [...nodesRef.current]
                .reverse()
                .forEach((node) => {
                    if (isNodeHidden(node)) return;
                    const anchor = getConnectionTargetAnchor(node, current);
                    const dx = world.x - anchor.x;
                    const dy = world.y - anchor.y;
                    const hitsHandle = dx * dx + dy * dy <= handleRadius * handleRadius;
                    const hitsInside = world.x >= node.position.x && world.x <= node.position.x + node.width && world.y >= node.position.y && world.y <= node.position.y + node.height;
                    const hitsExpanded = world.x >= node.position.x - padding && world.x <= node.position.x + node.width + padding && world.y >= node.position.y - padding && world.y <= node.position.y + node.height + padding;

                    if (!hitsHandle && !hitsInside && !hitsExpanded) return;
                    isNearNode = true;
                    if (node.id === current.nodeId || !normalizeConnection(current.nodeId, node.id, nodesRef.current, current.handleType)) return;

                    const priority = hitsInside ? 0 : hitsHandle ? 1 : 2;
                    if (priority < bestPriority) {
                        bestNodeId = node.id;
                        bestPriority = priority;
                    }
                });

            return { nodeId: bestNodeId, isNearNode };
        },
        [screenToCanvas],
    );

    const visibleNodes = useMemo(() => {
        const padding = 280;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || size.width;
        const height = rect?.height || size.height;
        const viewLeft = -viewport.x / viewport.k - padding;
        const viewTop = -viewport.y / viewport.k - padding;
        const viewRight = viewLeft + width / viewport.k + padding * 2;
        const viewBottom = viewTop + height / viewport.k + padding * 2;

        return nodes.filter((node) => !isNodeHidden(node) && node.position.x + node.width > viewLeft && node.position.x < viewRight && node.position.y + node.height > viewTop && node.position.y < viewBottom);
    }, [nodes, size.height, size.width, viewport.k, viewport.x, viewport.y]);

    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    // The toolbar follows a single selected node selected by click, creation, marquee, or keyboard.
    // It stays hidden for multi-selection and while isNodeDragging is true.
    const singleSelectedNodeId = selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null;
    const toolbarNode = (toolbarNodeId ? nodeById.get(toolbarNodeId) || null : null) || (singleSelectedNodeId ? nodeById.get(singleSelectedNodeId) || null : null);
    const infoNode = infoNodeId ? nodeById.get(infoNodeId) || null : null;
    const cropNode = cropNodeId ? nodeById.get(cropNodeId) || null : null;
    const maskEditNode = maskEditNodeId ? nodeById.get(maskEditNodeId) || null : null;
    const splitNode = splitNodeId ? nodeById.get(splitNodeId) || null : null;
    const resolutionNode = resolutionNodeId ? nodeById.get(resolutionNodeId) || null : null;
    const analyzeNode = analyzeNodeId ? nodeById.get(analyzeNodeId) || null : null;
    const segmentNode = segmentNodeId ? nodeById.get(segmentNodeId) || null : null;
    const angleNode = angleNodeId ? nodeById.get(angleNodeId) || null : null;
    const previewNode = previewNodeId ? nodeById.get(previewNodeId) || null : null;
    const previewContent = previewImageId ? previewNode?.metadata?.images?.find((image) => image.id === previewImageId)?.content : previewNode?.metadata?.content;
    const hasMultipleSelectedNodes = selectedNodeIds.size > 1;
    const selectedNodes = useMemo(() => nodes.filter((node) => selectedNodeIds.has(node.id)), [nodes, selectedNodeIds]);
    const alignSelection = (axis: AlignAxis) => {
        const positions = alignNodes(nodes, selectedNodeIds, axis);
        if (!positions.size) return;
        setNodes((prev) => prev.map((node) => { const next = positions.get(node.id); return next ? { ...node, position: next } : node; }));
    };
    const activeNodeId = hasMultipleSelectedNodes ? null : hoveredNodeId || (selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null);
    const boardLayerNodesById = useMemo(() => {
        const map = new Map<string, CanvasNodeData[]>();
        nodes.forEach((node) => {
            const boardId = node.type === CanvasNodeType.Image || node.type === CanvasNodeType.SmartCanvas ? node.metadata?.boardId : undefined;
            if (!boardId) return;
            const list = map.get(boardId);
            if (list) list.push(node);
            else map.set(boardId, [node]);
        });
        return map;
    }, [nodes]);
    const boardRenderLayersById = useMemo(() => {
        const map = new Map<string, CanvasNodeData[]>();
        boardLayerNodesById.forEach((list, boardId) => {
            const board = nodeById.get(boardId);
            if (board) map.set(boardId, orderBoardImages(board, list));
        });
        return map;
    }, [boardLayerNodesById, nodeById]);
    const boardOrderedLayersById = useMemo(() => {
        const map = new Map<string, CanvasNodeData[]>();
        boardLayerNodesById.forEach((list, boardId) => {
            const board = nodeById.get(boardId);
            if (!board) return;
            const ordered: CanvasNodeData[] = [];
            boardLayerImageIds(board, list).forEach((id) => {
                const node = list.find((item) => item.id === id);
                if (node) ordered.push(node);
            });
            map.set(boardId, ordered);
        });
        return map;
    }, [boardLayerNodesById, nodeById]);
    const relatedHighlight = useMemo(() => {
        const nodeIds = new Set<string>();
        const connectionIds = new Set<string>();

        if (!activeNodeId) return { nodeIds, connectionIds };

        const addNode = (nodeId: string) => {
            nodeIds.add(nodeId);
        };
        addNode(activeNodeId);
        connections.forEach((connection) => {
            if (connection.fromNodeId !== activeNodeId && connection.toNodeId !== activeNodeId) return;
            connectionIds.add(connection.id);
            addNode(connection.fromNodeId);
            addNode(connection.toNodeId);
        });

        return { nodeIds, connectionIds };
    }, [activeNodeId, connections]);

    const configInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Config && node.type !== CanvasNodeType.ImageGeneration) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);
    const mentionReferencesByNodeId = useMemo(() => {
        const map = new Map<string, ReturnType<typeof buildNodeMentionReferences>>();
        nodes.forEach((node) => map.set(node.id, buildNodeMentionReferences(node, nodes, connections)));
        return map;
    }, [connections, nodes]);
    const connectedNodesByNodeId = useMemo(() => {
        const map = new Map<string, CanvasNodeData[]>();
        connections.forEach((connection) => {
            const source = nodeById.get(connection.fromNodeId);
            if (!source) return;
            const connected = map.get(connection.toNodeId);
            if (connected) connected.push(source);
            else map.set(connection.toNodeId, [source]);
        });
        return map;
    }, [connections, nodeById]);
    const outputSourceById = useMemo(() => {
        const map = new Map<string, CanvasNodeData | null>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Assets) return;
            map.set(node.id, resolveLatestUpstream(node.id, nodes, connections, nodeUpdatedAt));
        });
        return map;
    }, [connections, nodeUpdatedAt, nodes]);
    const referenceConnectedNodeIds = useMemo(() => new Set([referencePickerNodeId, ...(referencePickerNodeId ? connectedNodesByNodeId.get(referencePickerNodeId)?.map((node) => node.id) || [] : [])].filter((id): id is string => Boolean(id))), [connectedNodesByNodeId, referencePickerNodeId]);
    const { applyAgentOps } = useAgentBridge({
        projectId,
        title: currentProject?.title,
        nodes,
        connections,
        selectedNodeIds,
        viewport,
        nodesRef,
        connectionsRef,
        selectedNodeIdsRef,
        viewportRef,
        generateNodeRef,
        setNodes,
        setConnections,
        setSelectedNodeIds,
        setSelectedConnectionId,
        setViewport,
    });

    const { pluginHost, renderPluginPanel, buildNodeToolbarItems } = usePluginHost({
        effectiveConfig,
        isAiConfigReady,
        openConfigDialog,
        theme,
        nodesRef,
        connectionsRef,
        viewportRef,
        setNodes,
        setDialogNodeId,
        applyAgentOps,
    });
    const { createNode, deleteNodes, deleteConnection, disconnectNodeReference, startNodeReferenceSelection, exitNodeReferenceSelection, selectNodeReference, deselectCanvas, duplicateNode, copySelectedNodes, pasteCopiedNodes, resetViewport, setZoomScale } = useCanvasDocument({
        effectiveConfig,
        getCanvasCenter,
        nodesRef,
        connectionsRef,
        selectedNodeIdsRef,
        clipboardRef,
        referencePickerNodeId,
        referenceConnectedNodeIds,
        cleanupCanvasFiles,
        projectId,
        chatSessions,
        size,
        cancelPendingConnectionCreate,
        setNodes,
        setConnections,
        setSelectedNodeIds,
        setSelectedConnectionId,
        setDialogNodeId,
        setHoveredNodeId,
        setToolbarNodeId,
        setInfoNodeId,
        setCropNodeId,
        setMaskEditNodeId,
        setAngleNodeId,
        setPreviewNodeId,
        setRunningNodeId,
        setReferencePickerNodeId,
        setExpandedBatchNodeIds,
        setSelectionBox,
        setViewport,
    });


    const handleCanvasMouseDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            setHoveredNodeId(null);
            setToolbarNodeId(null);
            setDialogNodeId(null);
            setIsNodeListOpen(false);
            if (pendingConnectionCreateRef.current) cancelPendingConnectionCreate();
            if (event.button !== 0) return;

            const world = screenToCanvas(event.clientX, event.clientY);
            const nextSelectionBox = {
                startWorldX: world.x,
                startWorldY: world.y,
                currentWorldX: world.x,
                currentWorldY: world.y,
                additive: event.shiftKey,
                initialSelectedNodeIds: event.shiftKey ? Array.from(selectedNodeIdsRef.current) : [],
            };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            if (!event.shiftKey) {
                setSelectedNodeIds(new Set());
            }

            setSelectedConnectionId(null);
        },
        [cancelPendingConnectionCreate, screenToCanvas],
    );

    // Selection-only logic shared by the bubbling drag entry point and outer capture handler.
    // Returns the single target ID after the click, or null for multi-selection or deselection, to sync the toolbar.
    const selectNodeByEvent = useCallback((event: Pick<ReactMouseEvent, "shiftKey" | "metaKey" | "ctrlKey">, nodeId: string) => {
        const nextSelected = new Set(selectedNodeIdsRef.current);
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            if (nextSelected.has(nodeId)) nextSelected.delete(nodeId);
            else nextSelected.add(nodeId);
        } else if (!nextSelected.has(nodeId)) {
            nextSelected.clear();
            nextSelected.add(nodeId);
        }
        setSelectedNodeIds(nextSelected);
        const soloId = nextSelected.size === 1 && nextSelected.has(nodeId) ? nodeId : null;
        setToolbarNodeId(soloId);
        return { nextSelected, soloId };
    }, []);

    // Capture-phase selection lets any inner element, including textarea or iframe, select the node and show its toolbar.
    // It only selects; body onMouseDown still starts dragging, so text selection inside editors does not drag the node.
    // Cache the capture result for the following bubbling drag handler to avoid applying shift-selection twice.
    const pendingSelectionRef = useRef<Set<string> | null>(null);
    const handleNodeSelectCapture = useCallback(
        (event: ReactMouseEvent, nodeId: string) => {
            if (event.button !== 0) return;
            setHoveredNodeId(null);
            setSelectedConnectionId(null);
            const { nextSelected } = selectNodeByEvent(event, nodeId);
            pendingSelectionRef.current = nextSelected;
        },
        [selectNodeByEvent],
    );

    const handleNodeMouseDown = useCallback((event: ReactMouseEvent, nodeId: string) => {
        event.stopPropagation();
        // Capture already selected the node; this only starts dragging, with a fallback selection if capture did not run.
        const currentNodes = nodesRef.current;
        const target = currentNodes.find((node) => node.id === nodeId);
        if (target && isNodeLocked(target)) {
            pendingSelectionRef.current = null;
            return;
        }
        const nextSelected = pendingSelectionRef.current ?? selectNodeByEvent(event, nodeId).nextSelected;
        pendingSelectionRef.current = null;
        const dragIds = new Set(
            [...nextSelected].filter((id) => {
                const node = currentNodes.find((item) => item.id === id);
                return Boolean(node && !isNodeLocked(node) && !isNodeHidden(node));
            }),
        );
        if (!dragIds.size) return;
        const addBoardLayers = (board: CanvasNodeData) => {
            currentNodes.forEach((child) => {
                if (dragIds.has(child.id) || child.metadata?.boardId !== board.id) return;
                dragIds.add(child.id);
                if (child.type === CanvasNodeType.SmartCanvas) addBoardLayers(child);
            });
        };
        currentNodes.forEach((node) => {
            if (!nextSelected.has(node.id)) return;
            if (node.type === CanvasNodeType.SmartCanvas) addBoardLayers(node);
        });
        dragRef.current = {
            isDraggingNode: true,
            hasMoved: false,
            startX: event.clientX,
            startY: event.clientY,
            initialSelectedNodes: currentNodes.filter((node) => dragIds.has(node.id)).map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        };
        historyPausedRef.current = true;
        nodeDraggingRef.current = true;
        setIsNodeDragging(true);
    }, []);

    const finishNodeDrag = useCallback((clientX?: number, clientY?: number) => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (!dragRef.current.isDraggingNode) return;

        const wasClick = !dragRef.current.hasMoved && dragRef.current.initialSelectedNodes.length === 1;
        const clickedNodeId = dragRef.current.initialSelectedNodes[0]?.id;
        const currentViewport = viewportRef.current;
        const dx = clientX == null ? 0 : (clientX - dragRef.current.startX) / currentViewport.k;
        const dy = clientY == null ? 0 : (clientY - dragRef.current.startY) / currentViewport.k;
        const initialPositions = dragRef.current.initialSelectedNodes;

        historyPausedRef.current = false;
        nodeDraggingRef.current = false;
        setIsNodeDragging(false);
        setDropTargetBoardId(null);
        setSnapGuides(EMPTY_SNAP_GUIDES);
        setDragPreview(null);
        dragMoveRef.current = null;
        if (dragRef.current.hasMoved && clientX != null && clientY != null) {
            const movedIds = new Set(initialPositions.map((item) => item.id));
            const snapped = snapDragToGuides(initialPositions, nodesRef.current, dx, dy, 6 / currentViewport.k, CANVAS_GRID_SIZE);
            setNodes((prev) => {
                const moved = prev.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    return initial ? { ...node, position: { x: initial.x + snapped.dx, y: initial.y + snapped.dy } } : node;
                });
                const targetBoard = findBoardDropTarget(movedIds, moved.filter((node) => !isNodeHidden(node)));
                const draggedBoardIds = new Set(moved.filter((node) => movedIds.has(node.id) && node.type === CanvasNodeType.SmartCanvas).map((node) => node.id));
                return moved.map((node) => {
                    let next = node;
                    if (movedIds.has(node.id) && (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.SmartCanvas) && !draggedBoardIds.has(node.metadata?.boardId || "")) {
                        const boardId = targetBoard && nodeCenterInside(node, targetBoard) ? targetBoard.id : undefined;
                        if (next.metadata?.boardId !== boardId) next = { ...next, metadata: { ...next.metadata, boardId } };
                    }
                    return next;
                });
            });
        }

        dragRef.current.isDraggingNode = false;
        dragRef.current.hasMoved = false;
        dragRef.current.initialSelectedNodes = [];
        if (wasClick && clickedNodeId) {
            const clickedNode = nodesRef.current.find((node) => node.id === clickedNodeId);
            const clickedDefinition = clickedNode ? getNodeDefinition(clickedNode.type) : undefined;
            if (clickedDefinition?.hidePanel) {
                // Clicking a display-only plugin node selects it without opening a lower panel.
                setDialogNodeId((current) => (current === clickedNodeId ? current : null));
            } else if (clickedNode) {
                setDialogNodeId(clickedNodeId);
            }
        }
    }, []);

    const moveNodeLayer = useCallback((nodeId: string, direction: "up" | "down") => {
        const current = nodesRef.current;
        const index = current.findIndex((node) => node.id === nodeId);
        if (index < 0) return;
        const step = direction === "up" ? 1 : -1;
        let target = index + step;
        while (target >= 0 && target < current.length && current[target].type === CanvasNodeType.SmartCanvas) target += step;
        if (target < 0 || target >= current.length) return;
        const next = [...current];
        const [node] = next.splice(index, 1);
        next.splice(target, 0, node);
        setNodes(next);
    }, []);

    const toggleNodeFlag = useCallback((nodeId: string, flag: "locked" | "hidden") => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, [flag]: !node.metadata?.[flag] } } : node)));
    }, []);

    const renameNodes = useCallback((ids: string[], title: string) => {
        const titles = bulkRenameTitles(ids, title);
        if (!titles.size) return;
        setNodes((prev) =>
            prev.map((node) => {
                const nextTitle = titles.get(node.id);
                return nextTitle ? { ...node, title: nextTitle } : node;
            }),
        );
    }, []);

    const handleGlobalMouseMove = useCallback(
        (event: MouseEvent) => {
            const currentViewport = viewportRef.current;

            if (dragRef.current.isDraggingNode) {
                dragMoveRef.current = { clientX: event.clientX, clientY: event.clientY };
                if (rafRef.current) return;
                rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = null;
                    const point = dragMoveRef.current;
                    if (!point || !dragRef.current.isDraggingNode) return;
                    const dx = (point.clientX - dragRef.current.startX) / currentViewport.k;
                    const dy = (point.clientY - dragRef.current.startY) / currentViewport.k;
                    const initialPositions = dragRef.current.initialSelectedNodes;
                    if (Math.abs(point.clientX - dragRef.current.startX) > 3 || Math.abs(point.clientY - dragRef.current.startY) > 3) {
                        dragRef.current.hasMoved = true;
                    }

                    const movedIds = new Set(initialPositions.map((item) => item.id));
                    const snap = dragRef.current.hasMoved ? snapDragToGuides(initialPositions, nodesRef.current, dx, dy, 6 / currentViewport.k, CANVAS_GRID_SIZE) : null;
                    const finalDx = snap?.dx ?? dx;
                    const finalDy = snap?.dy ?? dy;
                    setSnapGuides(snap?.guides ?? EMPTY_SNAP_GUIDES);
                    const previewNodes = nodesRef.current.map((node) => {
                        const initial = initialPositions.find((item) => item.id === node.id);
                        return initial ? { ...node, position: { x: initial.x + finalDx, y: initial.y + finalDy } } : node;
                    });
                    const dropCandidates = previewNodes.filter((node) => !isNodeHidden(node));
                    setDropTargetBoardId(findBoardDropTarget(movedIds, dropCandidates)?.id || null);
                    setDragPreview(new Map(initialPositions.map((item) => [item.id, { x: item.x + finalDx, y: item.y + finalDy }])));
                });
                return;
            }

            if (connectingParamsRef.current && !pendingConnectionCreateRef.current) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, connectingParamsRef.current);
                connectionTargetNodeIdRef.current = dropTarget.nodeId;
                setConnectionTargetNodeId(dropTarget.nodeId);
                setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            }
        },
        [getConnectionDropTarget, screenToCanvas],
    );

    const handleGlobalPointerMove = useCallback(
        (event: PointerEvent) => {
            const currentSelection = selectionBoxRef.current;
            if (!currentSelection) return;

            if (event.buttons === 0) {
                selectionBoxRef.current = null;
                setSelectionBox(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const rectX = Math.min(currentSelection.startWorldX, world.x);
            const rectY = Math.min(currentSelection.startWorldY, world.y);
            const rectW = Math.abs(world.x - currentSelection.startWorldX);
            const rectH = Math.abs(world.y - currentSelection.startWorldY);
            const nextSelected = new Set<string>(currentSelection.additive ? currentSelection.initialSelectedNodeIds : []);

            nodesRef.current
                .forEach((node) => {
                    const intersects = rectX < node.position.x + node.width && rectX + rectW > node.position.x && rectY < node.position.y + node.height && rectY + rectH > node.position.y;

                    if (intersects && !isNodeLocked(node) && !isNodeHidden(node)) nextSelected.add(node.id);
                });

            const nextSelectionBox = { ...currentSelection, currentWorldX: world.x, currentWorldY: world.y };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            setSelectedNodeIds(nextSelected);
        },
        [screenToCanvas],
    );

    const handleGlobalMouseUp = useCallback(
        (event: MouseEvent) => {
            finishNodeDrag(event.clientX, event.clientY);

            selectionBoxRef.current = null;
            setSelectionBox(null);

            if (pendingConnectionCreateRef.current) return;

            const currentConnection = connectingParamsRef.current;
            if (currentConnection) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, currentConnection);
                if (dropTarget.nodeId) {
                    connectNodes(currentConnection, dropTarget.nodeId);
                    setConnecting(null);
                } else if (dropTarget.isNearNode) {
                    setConnecting(null);
                } else {
                    setMouseWorld(screenToCanvas(event.clientX, event.clientY));
                    setPendingConnectionCreate({ connection: currentConnection, position: screenToCanvas(event.clientX, event.clientY) });
                }
            }
        },
        [connectNodes, finishNodeDrag, getConnectionDropTarget, screenToCanvas, setConnecting],
    );

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => finishNodeDrag(event.clientX, event.clientY);
        const cancelNodeDrag = () => finishNodeDrag();
        window.addEventListener("mousemove", handleGlobalMouseMove);
        window.addEventListener("mouseup", handleGlobalMouseUp);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", cancelNodeDrag);
        window.addEventListener("blur", cancelNodeDrag);
        window.addEventListener("pointermove", handleGlobalPointerMove);
        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", cancelNodeDrag);
            window.removeEventListener("blur", cancelNodeDrag);
            window.removeEventListener("pointermove", handleGlobalPointerMove);
        };
    }, [finishNodeDrag, handleGlobalMouseMove, handleGlobalMouseUp, handleGlobalPointerMove]);

    const { handleUploadRequest, handleImageInputChange, handleAssetInsert, insertFolderFile, handleDrop, pasteSystemClipboard } = useCanvasInsertion({
        containerRef,
        imageInputRef,
        uploadTargetRef,
        size,
        screenToCanvas,
        getCanvasCenter,
        message,
        t,
        setNodes,
        setSelectedNodeIds,
        setSelectedConnectionId,
        setDialogNodeId,
        setAssetPickerOpen,
    });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || target?.closest("[contenteditable='true'],[data-canvas-no-zoom],[data-canvas-shortcuts-ignore]")) return;

            const key = event.key.toLowerCase();
            const isModifierShortcut = event.metaKey || event.ctrlKey;

            if (isModifierShortcut && key === "c" && window.getSelection()?.toString()) return;

            if (isModifierShortcut && !event.altKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) redoCanvas();
                else undoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "y") {
                event.preventDefault();
                redoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "a") {
                event.preventDefault();
                setSelectedNodeIds(new Set(nodesRef.current.map((node) => node.id)));
                setSelectedConnectionId(null);
                setSelectionBox(null);
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "c") {
                event.preventDefault();
                copySelectedNodes();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "v") {
                event.preventDefault();
                if (!pasteCopiedNodes()) void pasteSystemClipboard();
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (selectedNodeIdsRef.current.size) {
                    deleteNodes(new Set(selectedNodeIdsRef.current));
                } else if (selectedConnectionId) {
                    deleteConnection(selectedConnectionId);
                }
            }

            if (event.key === "Escape") {
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                setSelectionBox(null);
                setConnecting(null);
                setHoveredNodeId(null);
                setToolbarNodeId(null);
                setDialogNodeId(null);
                setInfoNodeId(null);
                setCropNodeId(null);
                setMaskEditNodeId(null);
                setPendingConnectionCreate(null);
                setIsNodeListOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [copySelectedNodes, deleteConnection, deleteNodes, pasteCopiedNodes, pasteSystemClipboard, redoCanvas, selectedConnectionId, setConnecting, undoCanvas]);

    const handleConnectStart = useCallback(
        (event: ReactMouseEvent, nodeId: string, handleType: "source" | "target") => {
            event.stopPropagation();
            setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            setConnecting({ nodeId, handleType });
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
            setSelectedConnectionId(null);
        },
        [screenToCanvas, setConnecting],
    );

    const handleNodeResize = useCallback((nodeId: string, width: number, height: number, position?: Position) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, width, height, position: position || node.position } : node)));
    }, []);

    const handleNodeResizeStart = useCallback(() => {
        setIsNodeResizing(true);
    }, []);
    const handleNodeResizeEnd = useCallback(() => setIsNodeResizing(false), []);

    const toggleNodeFreeResize = useCallback((nodeId: string) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                const freeResize = !node.metadata?.freeResize;
                if (freeResize || node.type !== CanvasNodeType.Image) return { ...node, metadata: { ...node.metadata, freeResize } };
                const ratio = (node.metadata?.naturalWidth || node.width) / (node.metadata?.naturalHeight || node.height || 1);
                const height = node.width / ratio;
                return { ...node, height, position: { x: node.position.x, y: node.position.y + node.height / 2 - height / 2 }, metadata: { ...node.metadata, freeResize } };
            }),
        );
    }, []);

    const handleNodeContentChange = useCallback((nodeId: string, content: string) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                if (node.type === CanvasNodeType.Prompt) return { ...node, metadata: { ...node.metadata, prompt: content } };
                return { ...node, metadata: { ...node.metadata, content, texts: node.metadata?.texts?.map((text) => (text.id === node.metadata?.primaryTextId ? { ...text, content } : text)) } };
            }),
        );
    }, []);

    const handleNodeTitleChange = useCallback((nodeId: string, title: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, title } : node)));
    }, []);

    const toggleBatchExpanded = useCallback((nodeId: string) => {
        setExpandedBatchNodeIds((current) => {
            const next = new Set(current);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    }, []);

    const setBatchPrimary = useCallback((nodeId: string, itemId: string) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                if (node.type === CanvasNodeType.Text) {
                    const text = node.metadata?.texts?.find((item) => item.id === itemId);
                    return text?.content ? { ...node, metadata: { ...node.metadata, content: text.content, primaryTextId: text.id } } : node;
                }
                const image = node.metadata?.images?.find((item) => item.id === itemId);
                if (!image?.content) return node;
                const edge = Math.max(node.width, node.height);
                const size = node.metadata?.freeResize ? { width: node.width, height: node.height } : fitNodeSize(image.naturalWidth, image.naturalHeight, edge, edge);
                return {
                    ...node,
                    position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 },
                    ...size,
                    metadata: {
                        ...node.metadata,
                        content: image.content,
                        storageKey: image.storageKey,
                        thumbnail: image.thumbnail,
                        thumbnailKey: image.thumbnailKey,
                        naturalWidth: image.naturalWidth,
                        naturalHeight: image.naturalHeight,
                        bytes: image.bytes,
                        mimeType: image.mimeType,
                        primaryImageId: image.id,
                    },
                };
            }),
        );
    }, []);

    const duplicateBatchImage = useCallback((node: CanvasNodeData, imageId: string) => {
        const image = node.metadata?.images?.find((item) => item.id === imageId);
        if (!image?.content) return;
        const id = nanoid();
        const edge = Math.max(node.width, node.height);
        const size = fitNodeSize(image.naturalWidth, image.naturalHeight, edge, edge);
        const copy: CanvasNodeData = {
            id,
            type: CanvasNodeType.Image,
            title: node.title,
            position: { x: node.position.x + node.width * 2 + 96, y: node.position.y + node.height / 2 - size.height / 2 },
            ...size,
            metadata: {
                content: image.content,
                storageKey: image.storageKey,
                thumbnail: image.thumbnail,
                thumbnailKey: image.thumbnailKey,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                bytes: image.bytes,
                mimeType: image.mimeType,
                status: NODE_STATUS_SUCCESS,
                prompt: node.metadata?.prompt,
                generationType: node.metadata?.generationType,
                model: node.metadata?.model,
                size: node.metadata?.size,
                quality: node.metadata?.quality,
                background: node.metadata?.background,
                references: node.metadata?.references,
            },
        };
        setNodes((prev) => [...prev, copy]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const handleNodePromptChange = useCallback((nodeId: string, prompt: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt } } : node)));
    }, []);

    const handleConfigNodeChange = useCallback((nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? applyNodeConfigPatch(node, patch) : node)));
    }, []);

    const handleOutputFolderBind = useCallback(async (nodeId: string) => {
        if (!(await useAssetFolderStore.getState().bindOutputFolder())) return;
        handleConfigNodeChange(nodeId, { outputFolderName: useAssetFolderStore.getState().outputFolderName });
    }, [handleConfigNodeChange]);

    const handleOutputFolderUnbind = useCallback((nodeId: string) => {
        handleConfigNodeChange(nodeId, { outputFolderName: undefined });
        void useAssetFolderStore.getState().clearOutputFolder();
    }, [handleConfigNodeChange]);

    useEffect(() => {
        if (!outputFolderName) return;
        outputSourceById.forEach((source, outputId) => {
            if (!source || source.type === CanvasNodeType.Text) return;
            if (!nodeById.get(outputId)?.metadata?.outputFolderName) return;
            const fingerprint = outputSourceFingerprint(source.id, source.metadata?.storageKey, source.metadata?.content);
            if (outputWriteFingerprints.current.get(outputId) === fingerprint) return;
            outputWriteFingerprints.current.set(outputId, fingerprint);
            void (async () => {
                try {
                    const blob = await resolveOutputBlob(source);
                    if (!blob) return;
                    await useAssetFolderStore.getState().writeOutput(outputFileName(source.title, source.id, source.metadata?.mimeType, source.metadata?.storageKey), blob);
                } catch {
                    useAssetFolderStore.setState({ outputStatus: "error" });
                }
            })();
        });
    }, [nodeById, outputFolderName, outputSourceById]);

    const handleSmartCanvasChange = useCallback((nodeId: string, patch: Partial<CanvasNodeMetadata>) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId || node.type !== CanvasNodeType.SmartCanvas) return node;
                const next = { ...node, metadata: { ...node.metadata, ...patch } };
                if (patch.boardRatio && patch.boardRatio !== node.metadata?.boardRatio) {
                    const size = smartCanvasSizeForRatio(patch.boardRatio);
                    return { ...next, ...size, position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 } };
                }
                return next;
            }),
        );
    }, []);

    const handleBoardTextsChange = useCallback((nodeId: string, texts: NonNullable<CanvasNodeMetadata["boardTexts"]>) => handleSmartCanvasChange(nodeId, { boardTexts: texts }), [handleSmartCanvasChange]);

    const handleBoardLayerChange = useCallback((nodeId: string, patch: Partial<CanvasNodeMetadata>) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...patch } } : node)));
    }, []);

    const composeBoardImage = useCallback(
        async (board: CanvasNodeData) => {
            const placed = nodesRef.current.filter((node) => (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.SmartCanvas) && node.metadata?.boardId === board.id);
            if (!placed.length) {
                message.warning(t("canvas.smartCanvas.noContent"));
                return null;
            }
            try {
                const composite = await composeSmartCanvas(board, placed, nodesRef.current);
                if (!composite.dataUrl) {
                    message.warning(t("canvas.smartCanvas.noContent"));
                    return null;
                }
                return composite;
            } catch {
                message.error(t("canvas.smartCanvas.composeFailed"));
                return null;
            }
        },
        [message, t],
    );

    const handleComposeBoard = useCallback(
        async (board: CanvasNodeData) => {
            const composite = await composeBoardImage(board);
            if (composite) setBoardPreview({ ...composite, title: board.title || t("canvas.nodeTypes.smartCanvas"), boardId: board.id });
        },
        [composeBoardImage, t],
    );

    const handleSaveBoardAsNode = useCallback(
        async (board: CanvasNodeData) => {
            const composite = await composeBoardImage(board);
            if (!composite) return;
            try {
                const uploaded = await uploadImage(composite.dataUrl);
                const size = fitNodeSize(composite.width, composite.height, NODE_DEFAULT_SIZE[CanvasNodeType.Image].width, NODE_DEFAULT_SIZE[CanvasNodeType.Image].height);
                insertDerivedAsset(
                    {
                        source: board,
                        children: [{ image: uploaded, title: board.title || t("canvas.nodeTypes.smartCanvas"), size, position: { x: board.position.x + board.width + 40, y: board.position.y }, metadata: { naturalWidth: composite.width, naturalHeight: composite.height } }],
                        select: "children",
                        clearSelectedConnection: true,
                    },
                    { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
                );
                message.success(t("canvas.smartCanvas.savedAsNode"));
            } catch {
                message.error(t("common.imageReadFailed"));
            }
        },
        [composeBoardImage, message, t],
    );

    const handleArrangeBoard = useCallback(
        (board: CanvasNodeData, template: BoardLayoutTemplate = "grid") => {
            const placed = nodesRef.current.filter((node) => node.type === CanvasNodeType.Image && node.metadata?.boardId === board.id);
            if (!placed.length) {
                message.warning(t("canvas.smartCanvas.noContent"));
                return;
            }
            const ordered: CanvasNodeData[] = [];
            boardLayerImageIds(board, placed).forEach((id) => {
                const node = placed.find((item) => item.id === id);
                if (node) ordered.push(node);
            });
            const layout = new Map(arrangeBoardImages(board, ordered, template).map((item) => [item.id, item]));
            setNodes((prev) =>
                prev.map((node) => {
                    const item = layout.get(node.id);
                    return item ? { ...node, position: item.position, width: item.width, height: item.height } : node;
                }),
            );
            message.success(t("canvas.smartCanvas.arrangeDone"));
        },
        [message, t],
    );

    const handleSaveBoardPreview = useCallback(async () => {
        if (!boardPreview) return;
        const board = nodesRef.current.find((node) => node.id === boardPreview.boardId);
        if (!board) return;
        try {
            const uploaded = await uploadImage(boardPreview.dataUrl);
            const size = fitNodeSize(boardPreview.width, boardPreview.height, NODE_DEFAULT_SIZE[CanvasNodeType.Image].width, NODE_DEFAULT_SIZE[CanvasNodeType.Image].height);
            insertDerivedAsset(
                {
                    source: board,
                    children: [{ image: uploaded, title: boardPreview.title, size, position: { x: board.position.x + board.width + 40, y: board.position.y }, metadata: { naturalWidth: boardPreview.width, naturalHeight: boardPreview.height } }],
                    select: "children",
                    clearSelectedConnection: true,
                },
                { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
            );
            setBoardPreview(null);
            message.success(t("canvas.smartCanvas.savedAsNode"));
        } catch {
            message.error(t("common.imageReadFailed"));
        }
    }, [boardPreview, message, t]);

    const downloadNodeImage = useCallback((node: CanvasNodeData) => {
        if ((node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Audio) || !node.metadata?.content) return;
        saveAs(node.metadata.content, `canvas-${node.type}-${node.id}.${node.type === CanvasNodeType.Video ? "mp4" : node.type === CanvasNodeType.Audio ? audioExtension(node.metadata.mimeType) : imageExtension(node.metadata.content)}`);
    }, []);

    const downloadBatchImage = useCallback((node: CanvasNodeData, imageId: string) => {
        const image = node.metadata?.images?.find((item) => item.id === imageId);
        if (!image?.content) return;
        saveAs(image.content, `canvas-image-${node.id}-${image.id}.${imageExtension(image.content)}`);
    }, []);

    const captureVideoNodeFrame = useCallback(
        async (nodeId: string, position: VideoFramePosition) => {
            const node = nodesRef.current.find((item) => item.id === nodeId);
            const video = Array.from(containerRef.current!.querySelectorAll<HTMLVideoElement>("video[data-canvas-video]")).find((item) => item.dataset.canvasVideo === nodeId);
            if (node?.type !== CanvasNodeType.Video || !node.metadata?.content || !video) return message.error(t("canvas.videoFrames.failed"));
            try {
                const image = await uploadImage(await captureVideoFrame(node.metadata.content, position, video.currentTime));
                const size = fitNodeSize(image.width, image.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                const id = nanoid();
                const x = node.position.x + node.width + 96;
                let y = node.position.y + node.height / 2 - size.height / 2;
                while (nodesRef.current.some((item) => item.id !== node.id && item.position.x < x + size.width && item.position.x + item.width > x && item.position.y < y + size.height && item.position.y + item.height > y)) y += size.height + 24;
                insertDerivedAsset(
                    {
                        source: node,
                        children: [{ id, image, title: t(`canvas.videoFrames.${position}Title`, { name: node.title || t("assets.kinds.video") }), size, position: { x, y } }],
                        relation: "frame",
                        select: "children",
                        clearSelectedConnection: true,
                        openDialog: id,
                    },
                    { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
                );
                message.success(t("canvas.videoFrames.captured"));
            } catch {
                message.error(t("canvas.videoFrames.failed"));
            }
        },
        [message, t],
    );

    const saveNodeAsset = useCallback(
        async (node: CanvasNodeData) => {
            if (node.type === CanvasNodeType.Text) {
                const content = node.metadata?.content?.trim();
                if (!content) return message.error(t("canvas.projectPage.noTextToSave"));
                addAsset({ kind: "text", title: node.metadata?.prompt?.slice(0, 24) || t("canvas.projectPage.canvasText"), coverUrl: "", tags: [], source: "Canvas", data: { content }, metadata: { source: "canvas", nodeId: node.id } });
                message.success(t("common.addedToAssets"));
                return;
            }
            if (node.type === CanvasNodeType.Video) {
                if (!node.metadata?.content) return message.error(t("canvas.projectPage.noVideoToSave"));
                addAsset({
                    kind: "video",
                    title: node.metadata?.prompt?.slice(0, 24) || t("canvas.projectPage.canvasVideo"),
                    coverUrl: "",
                    tags: [],
                    source: "Canvas",
                    data: { url: node.metadata.content, storageKey: node.metadata.storageKey, width: node.width, height: node.height, bytes: node.metadata.bytes || 0, mimeType: node.metadata.mimeType || "video/mp4" },
                    metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt },
                });
                message.success(t("common.addedToAssets"));
                return;
            }
            if (!node.metadata?.content) return message.error(t("canvas.projectPage.noImageToSave"));
            const dataUrl = node.metadata.storageKey ? "" : node.metadata.content;
            addAsset({
                kind: "image",
                title: node.metadata?.prompt?.slice(0, 24) || t("canvas.projectPage.canvasImage"),
                coverUrl: node.metadata.content,
                tags: [],
                source: "Canvas",
                data: {
                    dataUrl,
                    storageKey: node.metadata.storageKey,
                    width: node.metadata.naturalWidth || node.width,
                    height: node.metadata.naturalHeight || node.height,
                    bytes: node.metadata.bytes || getDataUrlByteSize(dataUrl),
                    mimeType: node.metadata.mimeType || "image/png",
                },
                metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt },
            });
            message.success(t("common.addedToAssets"));
        },
        [addAsset, message, t],
    );

    const cropImageNode = useCallback(async (node: CanvasNodeData, crop: CanvasImageCropRect) => {
        if (!node.metadata?.content) return;
        const cropped = await cropDataUrl(node.metadata.content, crop);
        const image = await uploadImage(cropped);
        const width = Math.min(node.width, Math.max(220, image.width));
        const childId = nanoid();
        insertDerivedAsset(
            {
                source: node,
                children: [{ id: childId, image, title: "Cropped Image", size: { width, height: width * (image.height / image.width) }, metadata: { prompt: node.metadata?.prompt } }],
                relation: "crop",
                select: "children",
                openDialog: childId,
            },
            { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
        );
        setCropNodeId(null);
    }, []);

    const insertAnalyzedCrop = useCallback(
        async (node: CanvasNodeData, dataUrl: string) => {
            const image = await uploadImage(dataUrl);
            const width = Math.min(node.width, Math.max(220, image.width));
            const childId = nanoid();
            insertDerivedAsset(
                {
                    source: node,
                    children: [{ id: childId, image, title: t("canvas.imageAnalysis.smartCrop"), size: { width, height: width * (image.height / image.width) }, metadata: { prompt: node.metadata?.prompt } }],
                    relation: "crop",
                    select: "children",
                    openDialog: childId,
                },
                { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
            );
        },
        [t],
    );

    const removeNodeBackground = useCallback(async (node: CanvasNodeData) => {
        if (node.type !== CanvasNodeType.Image) return;
        const key = `remove-bg-${node.id}`;
        const progressTimer = window.setInterval(() => {
            const { status, percent } = useLocalModelStore.getState().models["background-removal"];
            if (status === "downloading") message.loading({ content: t("canvas.imageTools.removeBackgroundDownloading", { percent }), key, duration: 0 });
        }, 500);
        const prepared = await prepareModel("background-removal");
        window.clearInterval(progressTimer);
        if (!prepared) {
            message.error({ content: t("canvas.imageTools.removeBackgroundFailed"), key });
            return;
        }
        const source = await resolveImageUrl(node.metadata?.storageKey, node.metadata?.content || "");
        if (!source) {
            message.destroy(key);
            return;
        }
        message.loading({ content: t("canvas.imageTools.removeBackgroundRunning"), key, duration: 0 });
        try {
            const blob = await removeImageBackground(source, (progressKey, current, total) => {
                if (progressKey.startsWith("fetch") && total > 0) message.loading({ content: t("canvas.imageTools.removeBackgroundProgress", { percent: Math.round((current / total) * 100) }), key, duration: 0 });
            });
            const image = await uploadImage(blob);
            const width = Math.min(node.width, Math.max(220, image.width));
            insertDerivedAsset(
                {
                    source: node,
                    children: [{ image, title: t("canvas.imageTools.removeBackgroundResult"), size: { width, height: width * (image.height / image.width) }, metadata: { prompt: node.metadata?.prompt } }],
                    relation: "background-removal",
                    select: "children",
                },
                { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
            );
            message.success({ content: t("canvas.imageTools.removeBackgroundDone"), key });
        } catch {
            message.error({ content: t("canvas.imageTools.removeBackgroundFailed"), key });
        }
    }, [message, prepareModel, t]);

    const splitImageNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageSplitParams) => {
            if (!node.metadata?.content) return;
            setSplitNodeId(null);
            const pieces = await splitDataUrl(node.metadata.content, params);
            const gap = 16;
            const cellWidth = node.width / params.columns;
            const cellHeight = node.height / params.rows;
            const startX = node.position.x + node.width + 96;
            const startY = node.position.y;
            const images = await Promise.all(pieces.map((piece) => uploadImage(piece.dataUrl)));
            const childNodes = insertDerivedAsset(
                {
                    source: node,
                    children: pieces.map((piece, index) => ({
                        image: images[index],
                        title: t("canvas.projectPage.splitTitle", { name: node.title || t("assets.kinds.image"), row: piece.row + 1, column: piece.column + 1 }),
                        size: { width: cellWidth, height: cellHeight },
                        position: { x: startX + piece.column * (cellWidth + gap), y: startY + piece.row * (cellHeight + gap) },
                        metadata: { prompt: node.metadata?.prompt },
                    })),
                    relation: "split",
                    select: "children",
                    clearSelectedConnection: true,
                    openDialog: null,
                },
                { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
            );
            message.success(t("canvas.projectPage.splitSuccess", { count: childNodes.length }));
        },
        [message, t],
    );


    const upscaleImageNode = useCallback(async (node: CanvasNodeData, params: ImageUpscaleParams) => {
        if (!node.metadata?.content) return;
        setResolutionNodeId(null);
        const resized = await upscaleDataUrl(node.metadata.content, params);
        const image = await uploadImage(resized);
        const childId = nanoid();
        insertDerivedAsset(
            {
                source: node,
                children: [{ id: childId, image, title: t("canvas.imageTools.resolutionResult"), metadata: { prompt: node.metadata?.prompt } }],
                relation: "upscale",
                select: "children",
                openDialog: childId,
            },
            { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
        );
    }, [t]);

    const aiUpscaleImageNode = useCallback(async (node: CanvasNodeData, prompt: string) => {
        if (!node.metadata?.content) return;
        const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1", size: node.metadata?.size || "auto" };
        if (!effectiveConfig.imageModel || !isAiConfigReady(generationConfig, generationConfig.model)) {
            message.error(t("workbench.configFirst"));
            return;
        }
        setResolutionNodeId(null);
        const key = `ai-upscale-${node.id}`;
        message.loading({ content: t("canvas.imageTools.resolutionAiRunning"), key, duration: 0 });
        const controller = new AbortController();
        try {
            const source = { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey };
            const image = await requestEdit(generationConfig, prompt, [source], { signal: controller.signal }).then((items) => items[0]);
            const uploaded = await uploadImage(image.dataUrl, { signal: controller.signal });
            const childId = nanoid();
            insertDerivedAsset(
                {
                    source: node,
                    children: [{ id: childId, image: uploaded, title: t("canvas.imageTools.resolutionAiResult"), metadata: { prompt, model: generationConfig.model } }],
                    relation: "ai-upscale",
                    select: "children",
                    openDialog: childId,
                },
                { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
            );
            message.success({ content: t("canvas.imageTools.resolutionAiDone"), key });
        } catch (error) {
            message.error({ content: error instanceof Error ? error.message : t("canvas.imageTools.resolutionAiFailed"), key });
        }
    }, [effectiveConfig, isAiConfigReady, message, t]);

    const ocrImageNode = useCallback(async (node: CanvasNodeData) => {
        if (!node.metadata?.content) return;
        const textConfig = buildGenerationConfig(effectiveConfig, node, "text");
        if (!isAiConfigReady(textConfig, textConfig.model)) {
            openConfigDialog();
            return;
        }
        const key = `ocr-${node.id}`;
        message.loading({ content: t("canvas.imageTools.ocrRunning"), key, duration: 0 });
        const controller = new AbortController();
        try {
            const text = await extractImageText(textConfig, { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey }, { signal: controller.signal });
            insertDerivedAsset(
                {
                    source: node,
                    children: [{ type: CanvasNodeType.Text, title: text.slice(0, 32) || t("canvas.imageTools.ocrResult"), metadata: { content: text, prompt: ocrPrompt(), status: "success" } }],
                    select: "children",
                },
                { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
            );
            message.success({ content: t("canvas.imageTools.ocrResult"), key });
        } catch (error) {
            if (controller.signal.aborted) {
                message.destroy(key);
                return;
            }
            message.error({ content: error instanceof Error ? error.message : t("canvas.imageTools.ocrFailed"), key });
        }
    }, [effectiveConfig, isAiConfigReady, message, openConfigDialog, t]);

    const insertSegmentedImage = useCallback(
        async (node: CanvasNodeData, result: CanvasImageSegmentResult) => {
            const image = await uploadImage(result.maskDataUrl);
            const width = Math.min(node.width, Math.max(220, image.width));
            insertDerivedAsset(
                {
                    source: node,
                    children: [{ image, title: t("canvas.segment.result"), size: { width, height: width * (image.height / image.width) }, metadata: { prompt: node.metadata?.prompt } }],
                    relation: "segment",
                    select: "children",
                },
                { setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId },
            );
            setSegmentNodeId(null);
        },
        [t],
    );

    const handleResolutionConfirm = useCallback(
        (node: CanvasNodeData, payload: CanvasImageResolutionPayload) => {
            if (payload.kind === "ai") void aiUpscaleImageNode(node, payload.prompt);
            else void upscaleImageNode(node, payload);
        },
        [aiUpscaleImageNode, upscaleImageNode],
    );


    const handleFontSizeChange = useCallback((nodeId: string, fontSize: number) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, fontSize } } : node)));
    }, []);


    const startTitleEditing = useCallback(() => {
        setTitleDraft(currentProject?.title || t("canvas.projectPage.untitledCanvas"));
        setTitleEditing(true);
    }, [currentProject?.title, t]);

    const finishTitleEditing = useCallback(() => {
        const nextTitle = titleDraft.trim();
        if (nextTitle) renameProject(projectId, nextTitle);
        setTitleEditing(false);
    }, [projectId, renameProject, titleDraft]);

    useEffect(() => {
        generateNodeRef.current = handleGenerateNode;
    }, [handleGenerateNode]);


    const deleteBatchImage = useCallback((nodeId: string, imageId: string) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        if ((node?.metadata?.images?.length || 0) <= 2) setExpandedBatchNodeIds((current) => new Set([...current].filter((id) => id !== nodeId)));
        setNodes((prev) =>
            prev.map((item) => {
                if (item.id !== nodeId) return item;
                const images = item.metadata?.images?.filter((image) => image.id !== imageId) || [];
                return { ...item, metadata: { ...item.metadata, images, count: images.length, primaryImageId: item.metadata?.primaryImageId === imageId ? images[0]?.id : item.metadata?.primaryImageId } };
            }),
        );
    }, []);

    const retryBatchImage = useCallback((node: CanvasNodeData, imageId: string) => void handleRetryNode(node, imageId), [handleRetryNode]);

    const generateImageFromTextNode = useCallback(
        (node: CanvasNodeData) => {
            const prompt = (node.metadata?.content || node.metadata?.prompt || "").trim();
            if (!prompt) {
                message.warning(t("canvas.projectPage.emptyTextImage"));
                return;
            }
            const sourceNode = nodesRef.current.find((item) => item.id === node.id);
            if (!sourceNode) return;
            const nodeSize = getNodeSpec(CanvasNodeType.Config);
            const configNode = createCanvasNode(
                CanvasNodeType.Config,
                {
                    x: sourceNode.position.x + sourceNode.width + 96 + nodeSize.width / 2,
                    y: sourceNode.position.y + sourceNode.height / 2,
                },
                {
                    prompt: "",
                    model: effectiveConfig.imageModel || effectiveConfig.model,
                    size: effectiveConfig.size,
                    count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                },
            );
            const connection = { id: nanoid(), fromNodeId: sourceNode.id, toNodeId: configNode.id };
            const nextNodes = nodesRef.current.map((item) => (item.id === sourceNode.id ? { ...item, metadata: { ...item.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS } } : item)).concat(configNode);
            const nextConnections = [...connectionsRef.current, connection];
            nodesRef.current = nextNodes;
            connectionsRef.current = nextConnections;
            setNodes(nextNodes);
            setConnections(nextConnections);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message, t],
    );


    // Memoize every callback and render function passed to CanvasNode.
    // CanvasNode uses React.memo, but new prop references would invalidate it on every render and rerender every node
    // during click, hover, or viewport changes, which is especially expensive for Markdown. These useCallback values
    // and their memoized map/handler dependencies remain stable during interaction, so unchanged nodes do not rerender.
    const handleNodeHoverStart = useCallback((nodeId: string) => {
        if (nodeDraggingRef.current) return;
        setHoveredNodeId(nodeId);
    }, []);
    const handleNodeHoverEnd = useCallback((nodeId: string) => {
        setHoveredNodeId((current) => (current === nodeId ? null : current));
    }, []);
    const handleNodeViewImage = useCallback((node: CanvasNodeData, imageId?: string) => {
        setPreviewNodeId(node.id);
        setPreviewImageId(imageId || null);
    }, []);
    const handleNodeInfo = useCallback((node: CanvasNodeData) => setInfoNodeId(node.id), []);
    const handleNodeRetry = useCallback(
        (node: CanvasNodeData) => {
            if (node.type === CanvasNodeType.Text && (node.metadata?.textCount || 1) > 1) {
                void generateNodeRef.current?.(node.id, "text", node.metadata?.prompt || "");
                return;
            }
            void handleRetryNode(node);
        },
        [handleRetryNode],
    );
    const renderNodePanel = useCallback(
        (panelNode: CanvasNodeData) =>
            panelNode.type === CanvasNodeType.Image || panelNode.type === CanvasNodeType.Prompt ? null : getNodeDefinition(panelNode.type)?.Panel ? (
                renderPluginPanel(panelNode)
            ) : panelNode.type === CanvasNodeType.Config ? (
                <CanvasConfigComposer
                    nodeId={panelNode.id}
                    nodes={nodes}
                    value={panelNode.metadata?.composerContent ?? panelNode.metadata?.prompt ?? ""}
                    inputs={configInputsById.get(panelNode.id) || []}
                    connectedNodes={connectedNodesByNodeId.get(panelNode.id) || []}
                    onChange={(composerContent) => handleConfigNodeChange(panelNode.id, { composerContent })}
                    onClose={() => setDialogNodeId(null)}
                    onDisconnectReference={disconnectNodeReference}
                    onStartReferenceSelection={startNodeReferenceSelection}
                />
            ) : panelNode.type === CanvasNodeType.SmartCanvas ? (
                <div className="flex items-center gap-2" style={{ color: theme.node.text }}>
                    <SmartCanvasSettingsPopover ratio={panelNode.metadata?.boardRatio || "16:9"} resolution={panelNode.metadata?.boardResolution || "2k"} background={smartCanvasBackground(panelNode)} onChange={(patch) => handleSmartCanvasChange(panelNode.id, patch)} />
                    <Button size="small" type="text" className="!h-8 !rounded-full !px-2.5" style={{ color: theme.node.text }} icon={<ImagePlus className="size-3.5" />} onClick={() => void handleSaveBoardAsNode(panelNode)}>
                        {t("canvas.smartCanvas.saveAsNode")}
                    </Button>
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: BOARD_LAYOUT_TEMPLATES.map((template) => ({ key: template, label: t(BOARD_LAYOUT_LABEL_KEYS[template]) })),
                            onClick: ({ key }) => {
                                const template = BOARD_LAYOUT_TEMPLATES.find((item) => item === key);
                                if (template) handleArrangeBoard(panelNode, template);
                            },
                        }}
                    >
                        <Button size="small" type="text" className="!h-8 !rounded-full !px-2.5" style={{ color: theme.node.text }} icon={<LayoutGrid className="size-3.5" />}>
                            {t("canvas.smartCanvas.arrange")}
                        </Button>
                    </Dropdown>
                    <Button
                        size="small"
                        type="text"
                        className="!h-8 !rounded-full !px-2.5"
                        style={{ color: theme.node.text }}
                        icon={<Type className="size-3.5" />}
                        onClick={() =>
                            handleSmartCanvasChange(panelNode.id, {
                                boardTexts: [...smartCanvasTexts(panelNode), { id: nanoid(), text: t("canvas.smartCanvas.defaultText"), x: panelNode.width / 2 - 40, y: panelNode.height / 2 - 20, fontSize: SMART_CANVAS_DEFAULT_FONT_SIZE, color: theme.node.text }],
                            })
                        }
                    >
                        {t("canvas.smartCanvas.addText")}
                    </Button>
                    <SmartCanvasLayerPopover
                        images={boardOrderedLayersById.get(panelNode.id) || []}
                        onMove={(imageId, direction) => handleSmartCanvasChange(panelNode.id, { boardLayers: moveBoardLayer(panelNode, boardOrderedLayersById.get(panelNode.id) || [], imageId, direction) })}
                        onToggleHidden={(imageId) => toggleNodeFlag(imageId, "hidden")}
                        onBlendModeChange={(imageId, id) => handleBoardLayerChange(imageId, { blendMode: id })}
                        onOpacityChange={(imageId, value) => handleBoardLayerChange(imageId, { opacity: value })}
                    />
                </div>
            ) : (
                <CanvasNodePromptPanel
                    node={panelNode}
                    nodes={nodes}
                    isRunning={runningNodeId === panelNode.id}
                    mentionReferences={mentionReferencesByNodeId.get(panelNode.id) || EMPTY_REFERENCES}
                    connectedNodes={connectedNodesByNodeId.get(panelNode.id) || []}
                    onPromptChange={handleNodePromptChange}
                    onConfigChange={handleConfigNodeChange}
                    onGenerate={handleGenerateNode}
                    onStop={confirmStopGeneration}
                    onDisconnectReference={disconnectNodeReference}
                    onStartReferenceSelection={startNodeReferenceSelection}
                    modeOverride={getNodeDefinition(panelNode.type)?.useBuiltinPanel?.mode}
                    onImageSettingsOpenChange={(open) => {
                        setNodeImageSettingsOpen(open);
                        if (open) setToolbarNodeId(null);
                    }}
                />
            ),
        [boardOrderedLayersById, configInputsById, confirmStopGeneration, connectedNodesByNodeId, disconnectNodeReference, handleArrangeBoard, handleBoardLayerChange, handleComposeBoard, handleConfigNodeChange, handleGenerateNode, handleNodeContentChange, handleNodePromptChange, handleSmartCanvasChange, mentionReferencesByNodeId, nodes, renderPluginPanel, runningNodeId, startNodeReferenceSelection, t, theme.node.text, toggleNodeFlag],
    );

    const renderNodeContentPanel = useCallback(
        (contentNode: CanvasNodeData) => {
            if (contentNode.type === CanvasNodeType.Prompt) return <PromptNodePanel node={contentNode} onContentChange={handleNodeContentChange} />;
            if (contentNode.type === CanvasNodeType.Assets)
                return <AssetsNodeContent node={contentNode} onInsert={(file) => void insertFolderFile(file)} onOutputFolderBind={() => handleOutputFolderBind(contentNode.id)} onOutputFolderUnbind={() => handleOutputFolderUnbind(contentNode.id)} />;
            return (
            <CanvasConfigNodePanel
                node={contentNode}
                isRunning={runningNodeId === contentNode.id}
                inputSummary={getInputSummary(configInputsById.get(contentNode.id) || [])}
                onConfigChange={handleConfigNodeChange}
                onComposerToggle={() => setDialogNodeId((current) => (current === contentNode.id ? null : contentNode.id))}
                onStop={confirmStopGeneration}
                onReplay={handleReplayNode}
                onGenerate={(nodeId) => {
                    const target = nodesRef.current.find((item) => item.id === nodeId);
                    void handleGenerateMatrix(nodeId, target?.metadata?.generationMode || "image", target?.metadata?.composerContent ?? target?.metadata?.prompt ?? "");
                }}
            />
            );
        },
        [configInputsById, confirmStopGeneration, handleConfigNodeChange, handleGenerateMatrix, handleNodeContentChange, handleOutputFolderBind, handleOutputFolderUnbind, handleReplayNode, insertFolderFile, runningNodeId],
    );

    if (!projectLoaded && !loadedOnceRef.current) return <CanvasRefreshShell />;

    const guideBounds = snapGuides.x.length || snapGuides.y.length ? nodeBounds(nodes) : null;
    const guideSpan = guideBounds ? { left: guideBounds.left - 400, top: guideBounds.top - 400, right: guideBounds.right + 400, bottom: guideBounds.bottom + 400 } : null;

    return (
        <main className="relative flex h-full min-h-0 overflow-hidden" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <CanvasTopBar
                title={currentProject?.title || t("canvas.projectPage.untitledCanvas")}
                titleDraft={titleDraft}
                isTitleEditing={titleEditing}
                onTitleDraftChange={setTitleDraft}
                onStartTitleEditing={startTitleEditing}
                onFinishTitleEditing={finishTitleEditing}
                onCancelTitleEditing={() => setTitleEditing(false)}
                onProjects={() => navigate("/canvas")}
            />
            <div className="flex h-full shrink-0 pt-14">
                <CanvasSidePanel />
            </div>
            <section className="relative min-w-0 flex-1 overflow-hidden">
                <InfiniteCanvas
                    containerRef={containerRef}
                    viewport={viewport}
                    tool={canvasTool}
                    backgroundMode={effectiveConfig.canvasBackgroundMode}
                    onViewportChange={(next) => {
                        setViewport(next);
                    }}
                    onCanvasMouseDown={(event) => {
                        if (!referencePickerNodeId) handleCanvasMouseDown(event);
                    }}
                    onCanvasDeselect={referencePickerNodeId ? undefined : deselectCanvas}
                    onDrop={handleDrop}
                >
                    <svg className="absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ pointerEvents: "none", transform: "translateZ(0)", zIndex: 0 }}>
                        {connections
                            .map((connection) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                if (!from || !to) return null;
                                const fromPreview = dragPreview?.get(from.id);
                                const toPreview = dragPreview?.get(to.id);

                                return (
                                    <ConnectionPath
                                        key={connection.id}
                                        connection={connection}
                                        from={fromPreview ? { ...from, position: fromPreview } : from}
                                        to={toPreview ? { ...to, position: toPreview } : to}
                                        active={selectedConnectionId === connection.id || relatedHighlight.connectionIds.has(connection.id)}
                                        scale={viewport.k}
                                        onSelect={() => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                        }}
                                    />
                                );
                            })}
                        {connectingParams ? <ActiveConnectionPath node={nodeById.get(connectingParams.nodeId)} handle={connectingParams} mouseWorld={mouseWorld} target={connectionTargetNodeId ? nodeById.get(connectionTargetNodeId) : undefined} /> : null}
                    </svg>

                    {visibleNodes.map((node) => (
                        <CanvasNode
                            key={node.id}
                            data={node}
                            scale={viewport.k}
                            previewPosition={dragPreview?.get(node.id)}
                            isSelected={selectedNodeIds.has(node.id)}
                            isRelated={relatedHighlight.nodeIds.has(node.id)}
                            isFocusRelated={activeNodeId === node.id}
                            isConnectionTarget={connectionTargetNodeId === node.id}
                            isConnecting={Boolean(connectingParams)}
                            referenceSelectionState={!referencePickerNodeId ? undefined : node.id === referencePickerNodeId ? "target" : referenceConnectedNodeIds.has(node.id) || !isCanvasReferenceNode(node) ? "disabled" : "available"}
                            showPanel={!isNodeResizing && node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.ImageGeneration && node.type !== CanvasNodeType.Prompt && dialogNodeId === node.id && !selectionBox && !getNodeDefinition(node.type)?.hidePanel}
                            isBoardDropTarget={dropTargetBoardId === node.id}
                            boardLayers={boardRenderLayersById.get(node.id)}
                            boardLayersById={boardRenderLayersById}
                            onBoardTextsChange={handleBoardTextsChange}
                            batchExpanded={expandedBatchNodeIds.has(node.id)}
                            mentionReferences={mentionReferencesByNodeId.get(node.id) || EMPTY_REFERENCES}
                            pluginHost={pluginHost}
                            registryVersion={nodeRegistryVersion}
                            renderPanel={renderNodePanel}
                            renderNodeContent={renderNodeContentPanel}
                            onMouseDown={handleNodeMouseDown}
                            onSelectCapture={handleNodeSelectCapture}
                            onHoverStart={handleNodeHoverStart}
                            onHoverEnd={handleNodeHoverEnd}
                            onConnectStart={handleConnectStart}
                            onResizeStart={handleNodeResizeStart}
                            onResize={handleNodeResize}
                            onResizeEnd={handleNodeResizeEnd}
                            onContentChange={handleNodeContentChange}
                            onTitleChange={handleNodeTitleChange}
                            onToggleBatch={toggleBatchExpanded}
                            onSetBatchPrimary={setBatchPrimary}
                            onDuplicateBatchImage={duplicateBatchImage}
                            onDownloadBatchImage={downloadBatchImage}
                            onRetryBatchImage={retryBatchImage}
                            onDeleteBatchImage={deleteBatchImage}
                            onRetry={handleNodeRetry}
                            onViewImage={handleNodeViewImage}
                            onInfo={handleNodeInfo}
                        onBoardPreview={(board) => void handleComposeBoard(board)}
                            onSelectReference={selectNodeReference}
                        />
                    ))}

                    {guideSpan ? (
                        <svg className="pointer-events-none absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ zIndex: 45 }}>
                            {snapGuides.x.map((x) => (
                                <line key={`x-${x}`} x1={x} y1={guideSpan.top} x2={x} y2={guideSpan.bottom} stroke={selectionBlue} strokeWidth={1 / viewport.k} />
                            ))}
                            {snapGuides.y.map((y) => (
                                <line key={`y-${y}`} x1={guideSpan.left} y1={y} x2={guideSpan.right} y2={y} stroke={selectionBlue} strokeWidth={1 / viewport.k} />
                            ))}
                        </svg>
                    ) : null}

                    {referencePickerNodeId ? <button type="button" className={`absolute left-1/2 top-4 z-[90] -translate-x-1/2 rounded-full border px-4 py-2 text-sm font-medium ${frostedSurfaceClass}`} style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }} onClick={exitNodeReferenceSelection}>{t("canvas.references.selectingHint")}</button> : null}

                    {selectionBox ? (
                        <svg
                            className="pointer-events-none absolute z-[100] overflow-visible"
                            style={{
                                left: Math.min(selectionBox.startWorldX, selectionBox.currentWorldX),
                                top: Math.min(selectionBox.startWorldY, selectionBox.currentWorldY),
                                width: Math.abs(selectionBox.currentWorldX - selectionBox.startWorldX),
                                height: Math.abs(selectionBox.currentWorldY - selectionBox.startWorldY),
                            }}
                        >
                            <rect width="100%" height="100%" fill={theme.canvas.selectionFill} stroke={theme.canvas.selectionStroke} strokeOpacity={0.55} strokeWidth={1 / viewport.k} strokeDasharray={`${6 / viewport.k} ${4 / viewport.k}`} />
                        </svg>
                    ) : null}
                    {pendingConnectionCreate ? <ConnectionCreateMenu pending={pendingConnectionCreate} onCreate={(type) => createConnectedNode(type, pendingConnectionCreate)} onClose={cancelPendingConnectionCreate} /> : null}
                </InfiniteCanvas>

                <CanvasNodeHoverToolbar
                    node={isNodeDragging || isNodeResizing || nodeImageSettingsOpen || expandedBatchNodeIds.has(toolbarNode?.id || "") ? null : toolbarNode}
                    nodes={nodes}
                    viewport={viewport}
                    extraTools={toolbarNode ? buildNodeToolbarItems(toolbarNode) : undefined}
                    onKeep={keepNodeToolbar}
                    onLeave={hideNodeToolbar}
                    onInfo={(node) => setInfoNodeId(node.id)}
                    onDecreaseFont={(node) => handleFontSizeChange(node.id, Math.max(10, (node.metadata?.fontSize || 14) - 2))}
                    onIncreaseFont={(node) => handleFontSizeChange(node.id, Math.min(32, (node.metadata?.fontSize || 14) + 2))}
                    onTextStyleChange={handleConfigNodeChange}
                    onToggleDialog={(node) => setDialogNodeId((current) => (current === node.id ? null : node.id))}
                    onGenerateImage={generateImageFromTextNode}
                    onUpload={(node) => handleUploadRequest(node.id)}
                    onDownload={downloadNodeImage}
                    onSaveAsset={(node) => void saveNodeAsset(node)}
                    onMaskEdit={(node) => setMaskEditNodeId(node.id)}
                    onCrop={(node) => setCropNodeId(node.id)}
                    onRemoveBackground={(node) => void removeNodeBackground(node)}
                    onSplit={(node) => setSplitNodeId(node.id)}
                    onResolution={(node) => setResolutionNodeId(node.id)}
                    onAnalyze={(node) => setAnalyzeNodeId(node.id)}
                    onOcr={(node) => void ocrImageNode(node)}
                    onSegment={(node) => setSegmentNodeId(node.id)}
                    onAngle={(node) => setAngleNodeId(node.id)}
                    onRetry={(node) => void handleRetryNode(node)}
                    onToggleFreeResize={(node) => toggleNodeFreeResize(node.id)}
                    onDelete={(node) => deleteNodes(new Set([node.id]))}
                    onDuplicate={(node) => duplicateNode(node.id)}
                    onMoveLayer={moveNodeLayer}
                    onToggleFlag={toggleNodeFlag}
                    onBulkRename={renameNodes}
                    onCaptureVideoFrame={(node, position) => void captureVideoNodeFrame(node.id, position)}
                    onComposeBoard={(node) => void handleComposeBoard(node)}
                    onToggleName={(node, visible) => handleBoardLayerChange(node.id, { showTitle: visible })}
                />

                {hasMultipleSelectedNodes && !selectionBox ? (
                    <CanvasSelectionToolbar
                        nodes={selectedNodes}
                        viewport={viewport}
                        showToolbar={!isNodeDragging && !isNodeResizing}
                        onAlign={alignSelection}
                    />
                ) : null}

                <CanvasToolbar
                    selectedCount={selectedNodeIds.size}
                    canvasTool={canvasTool}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    onAddImage={() => createNode(CanvasNodeType.Image)}
                    onAddImageGeneration={() => createNode(CanvasNodeType.ImageGeneration)}
                    onAddPrompt={() => createNode(CanvasNodeType.Prompt)}
                    onAddVideo={() => createNode(CanvasNodeType.Video)}
                    onAddAudio={() => createNode(CanvasNodeType.Audio)}
                    onAddSmartCanvas={() => createNode(CanvasNodeType.SmartCanvas)}
                    onAddAssets={() => createNode(CanvasNodeType.Assets)}
                    onAddExtensionNode={(type) => createNode(type)}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    onDelete={() => deleteNodes(new Set(selectedNodeIds))}
                    onCanvasToolChange={setCanvasTool}
                    scale={viewport.k}
                    isMiniMapOpen={isMiniMapOpen}
                    onScaleChange={setZoomScale}
                    onResetViewport={resetViewport}
                    onToggleMiniMap={() => setIsMiniMapOpen((value) => !value)}
                    isNodeListOpen={isNodeListOpen}
                    onToggleNodeList={() => setIsNodeListOpen((value) => !value)}
                />

                <CanvasRulers viewport={viewport} viewportSize={size} />
                {isMiniMapOpen ? <Minimap nodes={nodes} viewport={viewport} viewportSize={size} onViewportChange={setViewport} /> : null}

                {isNodeListOpen ? (
                    <div className="absolute bottom-[84px] left-1/2 z-[60] w-[250px] -translate-x-1/2">
                        <CanvasNodeListPanel nodes={nodes} onToggleFlag={toggleNodeFlag} onBulkRename={renameNodes} />
                    </div>
                ) : null}

                <input ref={imageInputRef} type="file" multiple accept="image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" className="hidden" onChange={handleImageInputChange} />

                <CanvasNodeInfoModal node={infoNode} open={Boolean(infoNode)} onClose={() => setInfoNodeId(null)} />
                <CanvasPluginManagerModal open={pluginManagerOpen} onClose={() => setPluginManagerOpen(false)} />

                {cropNode?.metadata?.content ? <CanvasNodeCropDialog dataUrl={cropNode.metadata.content} open={Boolean(cropNode)} onClose={() => setCropNodeId(null)} onConfirm={(crop) => void cropImageNode(cropNode!, crop)} /> : null}

                {maskEditNode?.metadata?.content ? (
                    <CanvasNodeMaskEditDialog dataUrl={maskEditNode.metadata.content} open={Boolean(maskEditNode)} onClose={() => setMaskEditNodeId(null)} onConfirm={(payload) => void maskEditImageNode(maskEditNode!, payload)} />
                ) : null}

                {splitNode?.metadata?.content ? <CanvasNodeSplitDialog dataUrl={splitNode.metadata.content} open={Boolean(splitNode)} onClose={() => setSplitNodeId(null)} onConfirm={(params) => void splitImageNode(splitNode!, params)} /> : null}

                {resolutionNode?.metadata?.content ? (
                    <CanvasNodeResolutionDialog
                        dataUrl={resolutionNode.metadata.content}
                        open={Boolean(resolutionNode)}
                        onClose={() => setResolutionNodeId(null)}
                        onConfirm={(payload) => handleResolutionConfirm(resolutionNode, payload)}
                    />
                ) : null}

                {analyzeNode?.metadata?.content ? (
                    <CanvasImageAnalysisDialog
                        dataUrl={analyzeNode.metadata.content}
                        open={Boolean(analyzeNode)}
                        onClose={() => setAnalyzeNodeId(null)}
                        onCrop={(dataUrl) => void insertAnalyzedCrop(analyzeNode, dataUrl)}
                    />
                ) : null}

                {segmentNode?.metadata?.content ? (
                    <CanvasNodeSegmentDialog dataUrl={segmentNode.metadata.content} open={Boolean(segmentNode)} onClose={() => setSegmentNodeId(null)} onConfirm={(result) => void insertSegmentedImage(segmentNode, result)} />
                ) : null}

                {angleNode?.metadata?.content ? <CanvasNodeAngleDialog dataUrl={angleNode.metadata.content} open={Boolean(angleNode)} onClose={() => setAngleNodeId(null)} onConfirm={(params) => void generateAngleNode(angleNode!, params)} /> : null}

                <Modal
                    title={t("canvas.projectPage.imageDetails")}
                    open={Boolean(previewContent)}
                    centered
                    onCancel={() => setPreviewNodeId(null)}
                    footer={null}
                    width="auto"
                    styles={{ body: { padding: 0, display: "flex", justifyContent: "center", alignItems: "center", maxHeight: "80vh" } }}
                >
                    {previewContent ? <img src={previewContent} alt={previewNode?.title || t("assets.kinds.image")} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} /> : null}
                </Modal>

                <Modal
                    title={boardPreview?.title || t("canvas.smartCanvas.previewTitle")}
                    open={Boolean(boardPreview)}
                    centered
                    onCancel={() => setBoardPreview(null)}
                    footer={null}
                    width="auto"
                    styles={{ body: { padding: 0, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", maxHeight: "80vh" } }}
                >
                    {boardPreview ? (
                        <>
                            <img src={boardPreview.dataUrl} alt={boardPreview.title} style={{ maxWidth: "100%", maxHeight: "72vh", objectFit: "contain" }} />
                            <div className="flex items-center gap-2">
                                <Button icon={<ImagePlus className="size-4" />} onClick={() => void handleSaveBoardPreview()}>
                                    {t("canvas.smartCanvas.saveAsNode")}
                                </Button>
                                <Button type="primary" icon={<Download className="size-4" />} onClick={() => saveAs(boardPreview.dataUrl, `smart-canvas-${boardPreview.width}x${boardPreview.height}.png`)}>
                                    {t("canvas.smartCanvas.download")}
                                </Button>
                            </div>
                        </>
                    ) : null}
                </Modal>

                <AssetPickerModal open={assetPickerOpen} onInsert={handleAssetInsert} onClose={() => setAssetPickerOpen(false)} />
            </section>
        </main>
    );
}
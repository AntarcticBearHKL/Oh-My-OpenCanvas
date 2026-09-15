import { nanoid } from "nanoid";
import type { Dispatch, SetStateAction } from "react";

import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { imageMetadata } from "@/lib/canvas/canvas-node-factory";
import { fitNodeSize } from "@/lib/canvas/canvas-node-size";
import type { UploadedImage } from "@/services/image-storage";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type Position } from "@/types/canvas";

type DerivedAssetChild = {
    id?: string;
    type?: CanvasNodeType;
    image?: UploadedImage;
    title: string;
    size?: { width: number; height: number };
    position?: Position;
    metadata?: CanvasNodeMetadata;
};

type DerivedAssetSpec = {
    source: CanvasNodeData;
    children: DerivedAssetChild[];
    relation?: string;
    extraNodes?: CanvasNodeData[];
    extraConnections?: CanvasConnection[];
    select?: "children" | "source" | "none";
    clearSelectedConnection?: boolean;
    openDialog?: string | null;
};

type DerivedAssetState = {
    setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>;
    setConnections: Dispatch<SetStateAction<CanvasConnection[]>>;
    setSelectedNodeIds: Dispatch<SetStateAction<Set<string>>>;
    setSelectedConnectionId: Dispatch<SetStateAction<string | null>>;
    setDialogNodeId: Dispatch<SetStateAction<string | null>>;
};

export function insertDerivedAsset(spec: DerivedAssetSpec, state: DerivedAssetState): CanvasNodeData[] {
    const { source, children, relation, extraNodes = [], extraConnections = [], select, clearSelectedConnection = false, openDialog } = spec;
    const childNodes = children.map((child): CanvasNodeData => {
        const type = child.type ?? CanvasNodeType.Image;
        const size = child.size ?? (child.image ? fitNodeSize(child.image.width, child.image.height) : NODE_DEFAULT_SIZE[type]);
        return {
            id: child.id ?? nanoid(),
            type,
            title: child.title,
            position: child.position ?? { x: source.position.x + source.width + 96, y: source.position.y },
            width: size.width,
            height: size.height,
            metadata: { ...(child.image ? imageMetadata(child.image) : {}), ...child.metadata },
        };
    });
    state.setNodes((prev) => [...prev, ...extraNodes, ...childNodes]);
    const connections = [...(relation ? childNodes.map((child) => ({ id: nanoid(), fromNodeId: source.id, toNodeId: child.id, relation })) : []), ...extraConnections];
    if (connections.length) state.setConnections((prev) => [...prev, ...connections]);
    if (select === "children") state.setSelectedNodeIds(new Set(childNodes.map((child) => child.id)));
    else if (select === "source") state.setSelectedNodeIds(new Set([source.id]));
    if (clearSelectedConnection) state.setSelectedConnectionId(null);
    if (openDialog !== undefined) state.setDialogNodeId(openDialog);
    return childNodes;
}

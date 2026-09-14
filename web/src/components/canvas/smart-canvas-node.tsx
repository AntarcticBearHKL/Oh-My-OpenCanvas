import { useEffect, useState } from "react";
import { Frame } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { smartCanvasRatio, smartCanvasResolution } from "@/lib/canvas/smart-canvas";
import { resolveImageUrl } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData } from "@/types/canvas";

type SmartCanvasNodeContentProps = {
    node: CanvasNodeData;
    boardImages?: CanvasNodeData[];
};

export function SmartCanvasNodeContent({ node, boardImages = [] }: SmartCanvasNodeContentProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { t } = useTranslation();
    const urls = useResolvedBoardImageUrls(boardImages);
    const ratio = smartCanvasRatio(node);
    const resolution = smartCanvasResolution(node).toUpperCase();
    const gridColor = `${theme.node.stroke}22`;

    return (
        <div
            className="relative h-full w-full overflow-hidden rounded-[inherit]"
            style={{ background: theme.node.panel, backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`, backgroundSize: "24px 24px" }}
        >
            {boardImages.map((image) => {
                const url = urls[image.id];
                if (!url) return null;
                return (
                    <img
                        key={image.id}
                        src={url}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute select-none object-fill"
                        style={{ left: image.position.x - node.position.x, top: image.position.y - node.position.y, width: image.width, height: image.height }}
                    />
                );
            })}
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-dashed" style={{ borderColor: theme.node.stroke }} />
            {boardImages.length ? null : (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ color: theme.node.placeholder }}>
                    <Frame className="size-6 opacity-40" />
                    <span className="text-xs">{t("canvas.smartCanvas.empty")}</span>
                </div>
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium" style={{ background: theme.toolbar.panel, color: theme.node.muted }}>
                <span>{ratio}</span>
                <span>·</span>
                <span>{resolution}</span>
                <span>·</span>
                <span>{t("canvas.smartCanvas.placedCount", { count: boardImages.length })}</span>
            </div>
        </div>
    );
}

function useResolvedBoardImageUrls(images: CanvasNodeData[]) {
    const [urls, setUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        let active = true;
        void Promise.all(images.map(async (image) => [image.id, await resolveImageUrl(image.metadata?.storageKey, image.metadata?.content || "")] as const)).then((entries) => {
            if (active) setUrls(Object.fromEntries(entries));
        });
        return () => {
            active = false;
        };
    }, [images]);

    return urls;
}

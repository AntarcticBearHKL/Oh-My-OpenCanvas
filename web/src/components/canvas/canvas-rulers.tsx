import { useCanvasTheme } from "@/hooks/use-canvas-theme";
import type { ViewportTransform } from "@/types/canvas";

const RULER_THICKNESS = 20;
const MIN_TICK_SPACING = 56;
const BASE_TICK = 100;

export function CanvasRulers({ viewport, viewportSize }: { viewport: ViewportTransform; viewportSize: { width: number; height: number } }) {
    const theme = useCanvasTheme();
    const step = BASE_TICK * Math.max(1, Math.ceil(MIN_TICK_SPACING / (BASE_TICK * viewport.k)));
    const ticksX: number[] = [];
    for (let value = Math.floor(-viewport.x / viewport.k / step) * step; ; value += step) {
        const screen = viewport.x + value * viewport.k;
        if (screen > viewportSize.width) break;
        if (screen >= 0) ticksX.push(value);
    }
    const ticksY: number[] = [];
    for (let value = Math.floor(-viewport.y / viewport.k / step) * step; ; value += step) {
        const screen = viewport.y + value * viewport.k;
        if (screen > viewportSize.height) break;
        if (screen >= RULER_THICKNESS) ticksY.push(value);
    }
    const surface = { background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text };

    return (
        <>
            <div className="pointer-events-none absolute left-0 top-0 z-[70] w-full border-b" style={{ ...surface, height: RULER_THICKNESS }}>
                {ticksX.map((value) => (
                    <span key={value} className="absolute top-0 opacity-60" style={{ left: viewport.x + value * viewport.k + 4, fontSize: 10, lineHeight: `${RULER_THICKNESS}px` }}>
                        {value}
                    </span>
                ))}
            </div>
            <div className="pointer-events-none absolute left-0 z-[70] border-r" style={{ ...surface, top: RULER_THICKNESS, width: RULER_THICKNESS, height: Math.max(viewportSize.height - RULER_THICKNESS, 0) }}>
                {ticksY.map((value) => (
                    <span key={value} className="absolute left-0 opacity-60" style={{ top: viewport.y + value * viewport.k - RULER_THICKNESS + 4, fontSize: 10, writingMode: "vertical-rl" }}>
                        {value}
                    </span>
                ))}
            </div>
        </>
    );
}

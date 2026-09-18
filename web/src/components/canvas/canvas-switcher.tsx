import { Fragment, useMemo, useRef, useState } from "react";
import { FileUp, Folder, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

import { CanvasImportDialog } from "./canvas-import-dialog";

export function CanvasSwitcherTab({ theme }: { theme: CanvasTheme }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: currentId } = useParams();
    const projects = useCanvasStore((state) => state.projects);
    const groups = useCanvasStore((state) => state.groups);
    const reorderProjects = useCanvasStore((state) => state.reorderProjects);
    const createProject = useCanvasStore((state) => state.createProject);
    const [importOpen, setImportOpen] = useState(false);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const draggingRef = useRef(false);

    const current = projects.find((project) => project.id === currentId) || null;
    const groupId = current?.groupId || null;
    const groupName = groups.find((group) => group.id === groupId)?.name || "";
    const items = useMemo(() => (groupId ? projects.filter((project) => project.groupId === groupId) : projects), [groupId, projects]);

    const handleDrop = () => {
        if (dragId && dropIndex !== null) {
            const ids = items.map((project) => project.id);
            const from = ids.indexOf(dragId);
            if (from >= 0) {
                ids.splice(from, 1);
                ids.splice(dropIndex > from ? dropIndex - 1 : dropIndex, 0, dragId);
                reorderProjects(ids);
            }
        }
        setDragId(null);
        setDropIndex(null);
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-2 px-3 pb-3">
            <div className="flex items-center gap-1.5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    {groupName ? (
                        <>
                            <Folder className="size-3.5 shrink-0 opacity-70" style={{ color: theme.node.muted }} />
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium" style={{ color: theme.node.label }}>
                                {groupName}
                            </span>
                        </>
                    ) : null}
                </div>
                <button
                    type="button"
                    className="grid size-6 shrink-0 place-items-center rounded-md opacity-55 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                    title={t("canvas.switcher.new")}
                    aria-label={t("canvas.switcher.new")}
                    onClick={() => navigate(`/canvas/${createProject(undefined, groupId)}`)}
                >
                    <Plus className="size-3.5" />
                </button>
                <button
                    type="button"
                    className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] opacity-55 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                    title={t("canvas.switcher.load")}
                    aria-label={t("canvas.switcher.load")}
                    onClick={() => setImportOpen(true)}
                >
                    <FileUp className="size-3.5" />
                    <span>{t("canvas.switcher.load")}</span>
                </button>
            </div>
            <div
                className="thin-scrollbar min-h-0 flex-1 overflow-y-auto"
                onDragOver={(event) => {
                    if (dragId && event.target === event.currentTarget) {
                        event.preventDefault();
                        setDropIndex(items.length);
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    handleDrop();
                }}
            >
                {items.length ? (
                    items.map((project, index) => {
                        const isCurrent = project.id === currentId;
                        return (
                            <Fragment key={project.id}>
                                {dropIndex === index ? <div className="h-0.5 rounded-full" style={{ background: theme.node.activeStroke }} /> : null}
                                <button
                                    type="button"
                                    draggable
                                    className={cn(
                                        "flex w-full min-w-0 cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition",
                                        !isCurrent && "hover:bg-black/5 dark:hover:bg-white/10",
                                        dragId === project.id && "opacity-40",
                                    )}
                                    style={{ background: isCurrent ? theme.toolbar.activeBg : "transparent", color: theme.node.text }}
                                    onDragStart={(event) => {
                                        draggingRef.current = true;
                                        setDragId(project.id);
                                        event.dataTransfer.effectAllowed = "move";
                                        event.dataTransfer.setData("text/plain", project.id);
                                    }}
                                    onDragOver={(event) => {
                                        if (!dragId) return;
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = "move";
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        setDropIndex(index + (event.clientY > rect.top + rect.height / 2 ? 1 : 0));
                                    }}
                                    onDragEnd={() => {
                                        setDragId(null);
                                        setDropIndex(null);
                                        setTimeout(() => {
                                            draggingRef.current = false;
                                        }, 0);
                                    }}
                                    onClick={() => {
                                        if (draggingRef.current) return;
                                        if (!isCurrent) navigate(`/canvas/${project.id}`);
                                    }}
                                >
                                    <span className="min-w-0 flex-1 truncate">{project.title || t("canvas.untitledCanvas")}</span>
                                    <span className="shrink-0 text-[10px]" style={{ color: theme.node.muted }}>
                                        {t("canvas.switcher.nodes", { count: project.nodes.length })}
                                    </span>
                                </button>
                            </Fragment>
                        );
                    })
                ) : (
                    <div className="py-3 text-center text-xs opacity-45">{t("canvas.switcher.empty")}</div>
                )}
                {dropIndex === items.length ? <div className="h-0.5 rounded-full" style={{ background: theme.node.activeStroke }} /> : null}
            </div>
            <CanvasImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
        </div>
    );
}

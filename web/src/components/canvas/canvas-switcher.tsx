import { useMemo, useState } from "react";
import { Button, Input } from "antd";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

export function CanvasSwitcherTab({ theme }: { theme: CanvasTheme }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: currentId } = useParams();
    const projects = useCanvasStore((state) => state.projects);
    const groups = useCanvasStore((state) => state.groups);
    const createProject = useCanvasStore((state) => state.createProject);
    const [keyword, setKeyword] = useState("");

    const current = projects.find((project) => project.id === currentId) || null;
    const groupId = current?.groupId || null;
    const groupName = groups.find((group) => group.id === groupId)?.name || "";
    const items = useMemo(() => {
        const inGroup = groupId ? projects.filter((project) => project.groupId === groupId) : projects;
        const query = keyword.trim().toLowerCase();
        return [...inGroup].filter((project) => !query || (project.title || "").toLowerCase().includes(query)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }, [groupId, keyword, projects]);

    return (
        <div className="flex h-full min-h-0 flex-col gap-2 px-3 pb-3">
            <div className="flex items-center gap-1.5">
                <Input size="small" allowClear prefix={<Search className="size-3.5 opacity-60" />} placeholder={t("canvas.switcher.search")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                <Button
                    size="small"
                    type="text"
                    className="!h-7 !w-7 !min-w-7 shrink-0 !p-0"
                    style={{ color: theme.node.text }}
                    icon={<Plus className="size-4" />}
                    title={t("canvas.switcher.new")}
                    aria-label={t("canvas.switcher.new")}
                    onClick={() => navigate(`/canvas/${createProject(t("canvas.defaultTitle", { count: projects.length + 1 }), groupId)}`)}
                />
            </div>
            {groupName ? (
                <div className="truncate text-[11px]" style={{ color: theme.node.muted }}>
                    {t("canvas.switcher.group", { name: groupName })}
                </div>
            ) : null}
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
                {items.length ? (
                    items.map((project) => {
                        const isCurrent = project.id === currentId;
                        return (
                            <button
                                key={project.id}
                                type="button"
                                className={cn("flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition", !isCurrent && "hover:bg-black/5 dark:hover:bg-white/10")}
                                style={{ background: isCurrent ? theme.toolbar.activeBg : "transparent", color: theme.node.text }}
                                onClick={() => {
                                    if (!isCurrent) navigate(`/canvas/${project.id}`);
                                }}
                            >
                                <span className="min-w-0 flex-1 truncate">{project.title || t("canvas.untitledCanvas")}</span>
                                <span className="shrink-0 text-[10px]" style={{ color: theme.node.muted }}>
                                    {t("canvas.switcher.nodes", { count: project.nodes.length })}
                                </span>
                            </button>
                        );
                    })
                ) : (
                    <div className="py-3 text-center text-xs opacity-45">{t("canvas.switcher.empty")}</div>
                )}
            </div>
        </div>
    );
}

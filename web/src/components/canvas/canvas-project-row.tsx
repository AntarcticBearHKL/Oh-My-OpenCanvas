import { Check, Download, FolderInput, Pencil, Trash2, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Dropdown, Input } from "antd";
import { useTranslation } from "react-i18next";

import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";
import { useCanvasUiStore } from "@/stores/canvas/use-canvas-ui-store";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";

export function CanvasProjectRow({ project }: { project: CanvasProject }) {
    const { i18n, t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const groups = useCanvasStore((state) => state.groups);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const setProjectGroup = useCanvasStore((state) => state.setProjectGroup);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const editingId = useCanvasUiStore((state) => state.editingProjectId);
    const editingTitle = useCanvasUiStore((state) => state.editingProjectTitle);
    const startEditing = useCanvasUiStore((state) => state.startEditingProject);
    const setEditingTitle = useCanvasUiStore((state) => state.setEditingProjectTitle);
    const stopEditing = useCanvasUiStore((state) => state.stopEditingProject);
    const toggleSelected = useCanvasUiStore((state) => state.toggleSelectedProjectId);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const editing = editingId === project.id;
    const selected = selectedIds.includes(project.id);
    const open = () => {
        navigate(`/canvas/${project.id}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
    };
    const saveTitle = () => {
        renameProject(project.id, editingTitle);
        stopEditing();
    };

    return (
        <div
            className="flex h-14 w-full cursor-pointer items-center gap-2 border-b border-border px-2 transition last:border-b-0 hover:bg-black/5 dark:hover:bg-white/10"
            onClick={() => !editing && open()}
        >
            <input
                type="checkbox"
                checked={selected}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => toggleSelected(project.id, event.target.checked)}
                className="size-4 shrink-0 accent-stone-950 dark:accent-stone-100"
                aria-label={t("canvas.project.select", { name: project.title })}
            />
            {editing ? (
                <Input className="min-w-0 flex-1" size="small" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveTitle()} autoFocus />
            ) : (
                <button
                    type="button"
                    className="min-w-0 shrink cursor-pointer truncate text-left text-sm font-medium text-stone-900 dark:text-stone-100"
                    onClick={(event) => {
                        event.stopPropagation();
                        open();
                    }}
                >
                    {project.title}
                </button>
            )}
            <p className="hidden shrink-0 whitespace-nowrap text-xs text-stone-500 lg:block dark:text-stone-400" style={{ margin: 0 }}>
                {t("canvas.project.stats", { nodes: project.nodes.length, connections: project.connections.length })}
                <span className="mx-1.5">·</span>
                {t("canvas.project.updated", { date: new Date(project.updatedAt).toLocaleString(i18n.resolvedLanguage, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) })}
            </p>
            <div className="min-w-0 flex-1" />
            <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                {editing ? (
                    <>
                        <Button type="text" size="small" shape="circle" icon={<Check className="size-4" />} onClick={saveTitle} aria-label={t("canvas.project.saveName")} title={t("canvas.project.saveName")} />
                        <Button type="text" size="small" shape="circle" icon={<X className="size-4" />} onClick={stopEditing} aria-label={t("canvas.project.cancelRename")} title={t("canvas.project.cancelRename")} />
                    </>
                ) : (
                    <>
                        <Dropdown
                            trigger={["click"]}
                            menu={{
                                items: groups.map((group) => ({ key: group.id, label: group.name })),
                                selectable: true,
                                selectedKeys: [project.groupId ?? ""],
                                onClick: ({ key }) => setProjectGroup(project.id, key),
                            }}
                        >
                            <Button type="text" size="small" shape="circle" icon={<FolderInput className="size-4" />} aria-label={t("canvas.group.move")} title={t("canvas.group.move")} />
                        </Dropdown>
                        <Button
                            type="text"
                            size="small"
                            shape="circle"
                            icon={<Download className="size-4" />}
                            onClick={() => void exportCanvasProjects([project], project.title || t("canvas.title"))}
                            aria-label={t("canvas.project.export")}
                            title={t("canvas.project.export")}
                        />
                        <Button type="text" size="small" shape="circle" icon={<Pencil className="size-4" />} onClick={() => startEditing(project.id, project.title)} aria-label={t("canvas.project.rename")} title={t("canvas.project.rename")} />
                        <Button type="text" size="small" shape="circle" icon={<Trash2 className="size-4" />} onClick={() => setDeleteIds([project.id])} aria-label={t("canvas.project.delete")} title={t("canvas.project.delete")} />
                    </>
                )}
            </div>
        </div>
    );
}

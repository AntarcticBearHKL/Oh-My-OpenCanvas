import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App, Button, Empty, Input, Spin } from "antd";
import { Check, Download, FileUp, FolderPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { readZip } from "@/lib/zip";
import { setMediaBlob } from "@/services/file-storage";
import { setImageBlob } from "@/services/image-storage";
import { CanvasDeleteProjectsDialog } from "@/components/canvas/canvas-delete-projects-dialog";
import { CanvasProjectRow } from "@/components/canvas/canvas-project-row";
import type { CanvasExportFile } from "@/types/canvas-export";
import { useAssetStore } from "@/stores/use-asset-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useCanvasUiStore } from "@/stores/canvas/use-canvas-ui-store";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";

export default function CanvasPage() {
    const { message, modal } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inputRef = useRef<HTMLInputElement>(null);
    const autoOpenRef = useRef(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState("");
    const hydrated = useCanvasStore((state) => state.hydrated);
    const projects = useCanvasStore((state) => state.projects);
    const groups = useCanvasStore((state) => state.groups);
    const createProject = useCanvasStore((state) => state.createProject);
    const importProject = useCanvasStore((state) => state.importProject);
    const createGroup = useCanvasStore((state) => state.createGroup);
    const renameGroup = useCanvasStore((state) => state.renameGroup);
    const deleteGroup = useCanvasStore((state) => state.deleteGroup);
    const cleanupImages = useAssetStore((state) => state.cleanupImages);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const selectedGroupId = useCanvasUiStore((state) => state.selectedGroupId);
    const setSelectedGroupId = useCanvasUiStore((state) => state.setSelectedGroupId);

    const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
    const groupProjects = selectedGroup ? projects.filter((project) => project.groupId === selectedGroup.id) : [];

    const mode = searchParams.get("mode");
    const agentMode = mode === "new" || mode === "recent" || mode === "choose";
    const agentQuery = agentMode ? `?${searchParams.toString()}` : "";
    const enterProject = (id: string) => {
        navigate(`/canvas/${id}${agentQuery}`);
    };
    const createAndEnter = () => {
        if (!selectedGroup) return;
        enterProject(createProject(t("canvas.defaultTitle", { count: projects.length + 1 }), selectedGroup.id));
    };
    const importCanvas = async (file?: File) => {
        if (!file) return;
        try {
            const zip = await readZip(file);
            const projectFile = zip.get("projects.json");
            if (!projectFile) throw new Error("missing projects.json");
            const data = JSON.parse(await projectFile.text()) as CanvasExportFile;
            await Promise.all(
                data.projects.flatMap((project) =>
                    project.files.map(async (item) => {
                        const blob = zip.get(item.path);
                        if (!blob) return;
                        const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
                        await (item.storageKey.startsWith("image:") ? setImageBlob(item.storageKey, typedBlob) : setMediaBlob(item.storageKey, typedBlob));
                    }),
                ),
            );
            const groupId = selectedGroup?.id ?? groups[0]?.id ?? createGroup();
            data.projects.forEach((item) => importProject({ ...item.project, groupId }));
            message.success(t("canvas.imported", { count: data.projects.length }));
        } catch {
            message.error(t("canvas.importFailed"));
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };
    const addGroup = () => {
        setSelectedGroupId(createGroup());
    };
    const saveGroupName = () => {
        if (editingGroupId) renameGroup(editingGroupId, editingGroupName);
        setEditingGroupId(null);
    };
    const removeGroup = (id: string) => {
        setEditingGroupId(null);
        modal.confirm({
            title: t("canvas.group.deleteTitle"),
            content: t("canvas.group.deleteDescription"),
            okText: t("common.delete"),
            okButtonProps: { danger: true },
            cancelText: t("common.cancel"),
            onOk: () => {
                deleteGroup(id);
                cleanupImages();
            },
        });
    };

    useEffect(() => {
        if (groups.some((group) => group.id === selectedGroupId)) return;
        setSelectedGroupId(groups[0]?.id ?? null);
    }, [groups, selectedGroupId, setSelectedGroupId]);

    useEffect(() => {
        if (!hydrated || autoOpenRef.current || (mode !== "new" && mode !== "recent")) return;
        autoOpenRef.current = true;
        const title = t("canvas.defaultTitle", { count: projects.length + 1 });
        if (mode === "recent" && projects[0]) return enterProject(projects[0].id);
        enterProject(createProject(title, groups[0]?.id ?? createGroup()));
    }, [createGroup, createProject, groups, hydrated, mode, projects, t]);

    if (hydrated && (mode === "new" || mode === "recent")) return <main className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">{t("canvas.opening")}</main>;

    return (
        <main className="flex h-full min-h-0 bg-background text-foreground dark:text-foreground">
            <aside className="flex w-60 shrink-0 flex-col border-r border-border">
                <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground" style={{ margin: 0 }}>{t("canvas.library")}</p>
                    <Button type="text" size="small" shape="circle" icon={<Plus className="size-4" />} disabled={!hydrated} onClick={addGroup} aria-label={t("canvas.group.create")} title={t("canvas.group.create")} />
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                    {groups.map((group) => (
                        <div key={group.id}>
                            {editingGroupId === group.id ? (
                                <div className="flex h-9 items-center gap-1 rounded-xl bg-muted px-2">
                                    <Input
                                        size="small"
                                        className="min-w-0 flex-1"
                                        value={editingGroupName}
                                        onChange={(event) => setEditingGroupName(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") saveGroupName();
                                            if (event.key === "Escape") setEditingGroupId(null);
                                        }}
                                        autoFocus
                                    />
                                    <Button type="text" size="small" shape="circle" icon={<Check className="size-3.5" />} onClick={saveGroupName} aria-label={t("common.save")} title={t("common.save")} />
                                    <Button type="text" size="small" shape="circle" icon={<X className="size-3.5" />} onClick={() => setEditingGroupId(null)} aria-label={t("common.cancel")} title={t("common.cancel")} />
                                </div>
                            ) : (
                                <div className={`group flex h-9 items-center rounded-xl px-2 transition ${selectedGroupId === group.id ? "bg-black/10 dark:bg-card/10" : "hover:bg-black/5 dark:hover:bg-card/10"}`}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedGroupId(group.id)}
                                        className={`flex h-full min-w-0 flex-1 items-center gap-2 text-left text-sm ${selectedGroupId === group.id ? "text-foreground" : "text-muted-foreground"}`}
                                    >
                                        <span className="min-w-0 flex-1 truncate">{group.name}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground group-hover:hidden dark:text-muted-foreground">{projects.filter((project) => project.groupId === group.id).length}</span>
                                    </button>
                                    <div className="hidden shrink-0 items-center group-hover:flex">
                                        <Button
                                            type="text"
                                            size="small"
                                            shape="circle"
                                            icon={<Pencil className="size-3.5" />}
                                            onClick={() => {
                                                setEditingGroupId(group.id);
                                                setEditingGroupName(group.name);
                                            }}
                                            aria-label={t("canvas.group.rename")}
                                            title={t("canvas.group.rename")}
                                        />
                                        <Button type="text" size="small" shape="circle" icon={<Trash2 className="size-3.5" />} onClick={() => removeGroup(group.id)} aria-label={t("canvas.group.delete")} title={t("canvas.group.delete")} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
                <header className="shrink-0 border-b border-border">
                    <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-4 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <h1 className="truncate text-base font-semibold text-foreground" style={{ margin: 0 }}>{selectedGroup?.name ?? t("canvas.group.none")}</h1>
                            {selectedGroup ? <span className="shrink-0 text-xs text-muted-foreground">{t("canvas.group.count", { count: groupProjects.length })}</span> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedIds.length ? (
                                <>
                                    <Button disabled={!hydrated} icon={<Download className="size-4" />} onClick={() => void exportCanvasProjects(projects.filter((project) => selectedIds.includes(project.id)), `${t("canvas.title")}-${selectedIds.length}`)}>
                                        {t("canvas.exportSelected")}
                                    </Button>
                                    <Button disabled={!hydrated} onClick={() => setDeleteIds(selectedIds)}>
                                        {t("canvas.deleteSelected")}
                                    </Button>
                                </>
                            ) : projects.length ? (
                                <Button disabled={!hydrated} onClick={() => setDeleteIds(projects.map((project) => project.id))}>
                                    {t("canvas.deleteAll")}
                                </Button>
                            ) : null}
                            <Button disabled={!hydrated} icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>
                                {t("canvas.import")}
                            </Button>
                            <Button disabled={!hydrated || !selectedGroup} type="primary" icon={<Plus className="size-4" />} onClick={createAndEnter}>
                                {t("canvas.create")}
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                    {!hydrated ? (
                        <div className="flex h-full items-center justify-center">
                            <Spin />
                        </div>
                    ) : !selectedGroup ? (
                        <div className="flex h-full items-center justify-center">
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.group.createFirst")} className="py-16">
                                <Button type="primary" icon={<FolderPlus className="size-4" />} disabled={!hydrated} onClick={addGroup}>
                                    {t("canvas.group.create")}
                                </Button>
                            </Empty>
                        </div>
                    ) : groupProjects.length ? (
                        <div className="overflow-hidden rounded-2xl ring-1 ring-border">
                            {groupProjects.map((project) => (
                                <CanvasProjectRow key={project.id} project={project} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.group.empty")} className="py-16">
                                <Button type="primary" icon={<Plus className="size-4" />} disabled={!hydrated} onClick={createAndEnter}>
                                    {t("canvas.create")}
                                </Button>
                            </Empty>
                        </div>
                    )}
                </div>
            </section>

            <input ref={inputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importCanvas(event.target.files?.[0])} />
            <CanvasDeleteProjectsDialog />
        </main>
    );
}

import { useEffect } from "react";
import { Button } from "antd";
import { FolderOpen, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { hasAgentUrlBootstrap } from "@/lib/agent/agent-url-bootstrap";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

export default function HomePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const hydrated = useCanvasStore((state) => state.hydrated);
    const projects = useCanvasStore((state) => state.projects);
    const createProject = useCanvasStore((state) => state.createProject);

    // Agent-driven entries carry a #agentUrl/#agentToken bootstrap; the canvas library
    // page owns the auto-create + auto-connect flow, so hand off there.
    useEffect(() => {
        if (hasAgentUrlBootstrap(window.location.hash)) {
            navigate(`/canvas${window.location.search}`, { replace: true });
        }
    }, [navigate]);

    const createAndEnter = () => {
        const id = createProject(t("canvas.defaultTitle", { count: projects.length + 1 }));
        const agentHash = hasAgentUrlBootstrap(window.location.hash) ? window.location.hash : "";
        navigate(`/canvas/${id}${agentHash}`, { replace: Boolean(agentHash) });
    };

    return (
        <main className="flex h-full items-center justify-center overflow-y-auto bg-background px-5 py-8 text-stone-950 sm:px-6 dark:text-stone-100">
            <div className="w-full max-w-sm text-center">
                <div className="mx-auto size-12 bg-current" style={{ mask: "url(/logo.svg) center / contain no-repeat" }} />
                <h1 className="mt-6 text-2xl font-semibold">{t("meta.title")}</h1>
                <div className="mt-8 grid gap-3 sm:mt-10">
                    <Button type="primary" size="large" icon={<Plus className="size-4" />} disabled={!hydrated} onClick={createAndEnter}>
                        {t("canvas.create")}
                    </Button>
                    <Button size="large" icon={<FolderOpen className="size-4" />} disabled={!hydrated} onClick={() => navigate("/canvas")}>
                        {t("home.openCanvas")}
                    </Button>
                </div>
            </div>
        </main>
    );
}

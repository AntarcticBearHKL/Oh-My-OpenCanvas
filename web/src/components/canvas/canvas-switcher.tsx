import { useMemo } from "react";
import { Select } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

export function CanvasSwitcher() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: currentId } = useParams();
    const projects = useCanvasStore((state) => state.projects);
    const options = useMemo(
        () =>
            [...projects]
                .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
                .map((project) => ({ value: project.id, label: `${project.title || t("canvas.untitledCanvas")} · ${t("canvas.switcher.nodes", { count: project.nodes.length })}` })),
        [projects, t],
    );

    return (
        <Select
            showSearch
            size="small"
            className="w-full"
            value={currentId}
            placeholder={t("canvas.switcher.placeholder")}
            optionFilterProp="label"
            options={options}
            onChange={(value) => {
                if (value !== currentId) navigate(`/canvas/${value}`);
            }}
        />
    );
}

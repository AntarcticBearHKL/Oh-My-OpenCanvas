import { useEffect, useState } from "react";
import { Button, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";

import { buildMatrixVariants, type GenerationMatrix } from "@/lib/canvas/generation-matrix";

type CanvasGenerationMatrixDialogProps = {
    open: boolean;
    matrix?: GenerationMatrix;
    onClose: () => void;
    onConfirm: (matrix: GenerationMatrix | undefined) => void;
};

export function CanvasGenerationMatrixDialog({ open, matrix, onClose, onConfirm }: CanvasGenerationMatrixDialogProps) {
    const { t } = useTranslation();
    const [sizes, setSizes] = useState("");
    const [counts, setCounts] = useState("");
    const [prompts, setPrompts] = useState("");

    useEffect(() => {
        if (!open) return;
        setSizes(joinMatrixValues(matrix?.sizes));
        setCounts(joinMatrixValues(matrix?.counts));
        setPrompts(joinMatrixValues(matrix?.prompts));
    }, [matrix, open]);

    const variantCount = buildMatrixVariants(parseMatrix(sizes, counts, prompts)).length;

    return (
        <Modal title={null} open={open} onCancel={onClose} footer={null} width={560} centered destroyOnHidden>
            <div className="space-y-5">
                <div>
                    <h2 className="text-lg font-semibold">{t("canvas.configNode.matrixTitle")}</h2>
                    <p className="mt-1 text-sm opacity-60">{t("canvas.configNode.matrixDescription")}</p>
                </div>
                <div className="space-y-3">
                    <MatrixField label={t("canvas.configNode.matrixSizes")} value={sizes} onChange={setSizes} />
                    <MatrixField label={t("canvas.configNode.matrixCounts")} value={counts} onChange={setCounts} />
                    <MatrixField label={t("canvas.configNode.matrixPrompts")} value={prompts} onChange={setPrompts} multiline />
                </div>
                <p className="text-xs opacity-60">{t("canvas.configNode.matrixHint")}</p>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium opacity-75">{t("canvas.configNode.matrixVariants", { count: variantCount })}</span>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => {
                                setSizes("");
                                setCounts("");
                                setPrompts("");
                            }}
                        >
                            {t("canvas.configNode.matrixClear")}
                        </Button>
                        <Button type="primary" onClick={() => onConfirm(parseMatrix(sizes, counts, prompts))}>
                            {t("canvas.configNode.matrixSave")}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function MatrixField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium opacity-75">{label}</span>
            {multiline ? <Input.TextArea value={value} onChange={(event) => onChange(event.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} /> : <Input value={value} onChange={(event) => onChange(event.target.value)} />}
        </label>
    );
}

function splitMatrixValues(value: string) {
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function joinMatrixValues(values?: Array<string | number>) {
    return (values || []).join(", ");
}

function parseMatrix(sizes: string, counts: string, prompts: string): GenerationMatrix | undefined {
    const sizeValues = splitMatrixValues(sizes);
    const countValues = splitMatrixValues(counts)
        .map(Number)
        .filter((value) => Number.isFinite(value) && value > 0);
    const promptValues = splitMatrixValues(prompts);
    if (!sizeValues.length && !countValues.length && !promptValues.length) return undefined;
    return { sizes: sizeValues.length ? sizeValues : undefined, counts: countValues.length ? countValues : undefined, prompts: promptValues.length ? promptValues : undefined };
}

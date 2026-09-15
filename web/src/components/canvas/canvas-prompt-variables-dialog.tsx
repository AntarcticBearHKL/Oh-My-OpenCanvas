import { useEffect, useState } from "react";
import { Button, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";

import { applyPromptVariables, resolvePromptVariableList, type PromptVariable } from "@/lib/canvas/prompt-variables";

type CanvasPromptVariablesDialogProps = {
    open: boolean;
    prompt: string;
    variables?: PromptVariable[];
    onClose: () => void;
    onConfirm: (variables: PromptVariable[] | undefined) => void;
};

export function CanvasPromptVariablesDialog({ open, prompt, variables, onClose, onConfirm }: CanvasPromptVariablesDialogProps) {
    const { t } = useTranslation();
    const [rows, setRows] = useState<PromptVariable[]>([]);

    useEffect(() => {
        if (!open) return;
        setRows(resolvePromptVariableList(prompt, variables));
    }, [open, prompt, variables]);

    const filled = rows.filter((row) => row.value.trim());
    const resolved = applyPromptVariables(prompt, filled);

    return (
        <Modal title={null} open={open} onCancel={onClose} footer={null} width={560} centered destroyOnHidden>
            <div className="space-y-5">
                <div>
                    <h2 className="text-lg font-semibold">{t("canvas.promptPanel.variablesTitle")}</h2>
                    <p className="mt-1 text-sm opacity-60">{t("canvas.promptPanel.variablesDescription")}</p>
                </div>
                {rows.length ? (
                    <div className="space-y-3">
                        {rows.map((row, index) => (
                            <label key={`${row.name}:${index}`} className="block space-y-1.5">
                                <span className="text-sm font-medium opacity-75">{`{{${row.name}}}`}</span>
                                <Input value={row.value} placeholder={t("canvas.promptPanel.variablesPlaceholder")} onChange={(event) => setRows(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))} />
                            </label>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm opacity-60">{t("canvas.promptPanel.variablesEmpty")}</p>
                )}
                <div className="space-y-1.5">
                    <span className="text-sm font-medium opacity-75">{t("canvas.promptPanel.variablesPreview")}</span>
                    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border px-3 py-2 text-sm opacity-80">{resolved}</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                    <Button onClick={() => setRows(rows.map((row) => ({ ...row, value: "" })))}>{t("canvas.promptPanel.variablesClear")}</Button>
                    <Button type="primary" onClick={() => onConfirm(filled.length ? filled : undefined)}>{t("canvas.promptPanel.variablesSave")}</Button>
                </div>
            </div>
        </Modal>
    );
}

import { App, Button, Popconfirm, Progress } from "antd";
import { Download, Eraser, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLocalModelStore } from "@/stores/use-local-model-store";

async function clearModelCaches() {
    if (typeof caches === "undefined") return;
    try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.toLowerCase().includes("imgly")).map((key) => caches.delete(key)));
    } catch {
        return;
    }
}

export function ConfigLocalModels() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const backgroundRemoval = useLocalModelStore((state) => state.backgroundRemoval);
    const prepareBackgroundRemoval = useLocalModelStore((state) => state.prepareBackgroundRemoval);
    const clearBackgroundRemovalModel = useLocalModelStore((state) => state.clearBackgroundRemovalModel);
    const downloading = backgroundRemoval.status === "downloading";
    const deletable = backgroundRemoval.status === "ready" || backgroundRemoval.status === "error";

    const download = async () => {
        if (await prepareBackgroundRemoval(backgroundRemoval.status === "ready")) message.success(t("config.localModels.downloadDone"));
        else message.error(t("config.localModels.downloadFailed"));
    };

    const remove = async () => {
        clearBackgroundRemovalModel();
        await clearModelCaches();
        message.success(t("config.localModels.deleteDone"));
    };

    return (
        <div className="space-y-3">
            <div>
                <div className="text-sm font-semibold">{t("config.localModels.title")}</div>
                <div className="mt-1 text-xs text-stone-500">{t("config.localModels.description")}</div>
            </div>
            <section className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Eraser className="size-4" />
                            {t("config.localModels.backgroundRemoval")}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{t("config.localModels.backgroundRemovalDescription")}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-stone-500">
                        <div>{t("config.localModels.size")}</div>
                        <div className="mt-0.5">{t(`config.localModels.status.${backgroundRemoval.status}`, { percent: backgroundRemoval.percent })}</div>
                    </div>
                </div>
                {downloading ? <Progress className="mt-3" percent={backgroundRemoval.percent} size="small" showInfo={false} /> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="primary" icon={<Download className="size-4" />} loading={downloading} disabled={downloading} onClick={() => void download()}>
                        {t(backgroundRemoval.status === "ready" ? "config.localModels.redownload" : "config.localModels.download")}
                    </Button>
                    <Popconfirm title={t("config.localModels.deleteConfirm")} description={t("config.localModels.deleteConfirmDescription")} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }} disabled={!deletable} onConfirm={() => void remove()}>
                        <Button danger disabled={!deletable} icon={<Trash2 className="size-4" />}>
                            {t("common.delete")}
                        </Button>
                    </Popconfirm>
                </div>
            </section>
        </div>
    );
}

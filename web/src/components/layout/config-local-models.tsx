import { App, Button, Progress } from "antd";
import { Eraser } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLocalModelStore } from "@/stores/use-local-model-store";

export function ConfigLocalModels() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const backgroundRemoval = useLocalModelStore((state) => state.backgroundRemoval);
    const prepareBackgroundRemoval = useLocalModelStore((state) => state.prepareBackgroundRemoval);
    const downloading = backgroundRemoval.status === "downloading";

    const download = async () => {
        if (await prepareBackgroundRemoval(backgroundRemoval.status === "ready")) message.success(t("config.localModels.downloadDone"));
        else message.error(t("config.localModels.downloadFailed"));
    };

    return (
        <div className="space-y-3">
            <div>
                <div className="text-sm font-semibold">{t("config.localModels.title")}</div>
                <div className="mt-1 text-xs text-stone-500">{t("config.localModels.description")}</div>
            </div>
            <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Eraser className="size-4" />
                            {t("config.localModels.backgroundRemoval")}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{t("config.localModels.backgroundRemovalDescription")}</div>
                    </div>
                    <div className="text-xs text-stone-500">
                        {t("config.localModels.size")} · {t(`config.localModels.status.${backgroundRemoval.status}`, { percent: backgroundRemoval.percent })}
                    </div>
                </div>
                {downloading ? <Progress className="mt-3" percent={backgroundRemoval.percent} size="small" showInfo={false} /> : null}
                <div className="mt-3">
                    <Button type="primary" loading={downloading} disabled={downloading} onClick={() => void download()}>
                        {t(backgroundRemoval.status === "ready" ? "config.localModels.redownload" : "config.localModels.download")}
                    </Button>
                </div>
            </section>
        </div>
    );
}

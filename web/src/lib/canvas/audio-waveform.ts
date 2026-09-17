export const AUDIO_WAVEFORM_BARS = 96;

const peaksCache = new Map<string, number[] | null>();
const pendingPeaks = new Map<string, Promise<number[] | null>>();
let sharedContext: AudioContext | null = null;

export function getCachedAudioPeaks(key: string) {
    return peaksCache.get(key) ?? null;
}

export function loadAudioPeaks(key: string, src: string): Promise<number[] | null> {
    const cached = peaksCache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = pendingPeaks.get(key);
    if (pending) return pending;
    const task = decodeAudioPeaks(src).then((peaks) => {
        peaksCache.set(key, peaks);
        pendingPeaks.delete(key);
        return peaks;
    });
    pendingPeaks.set(key, task);
    return task;
}

export function formatAudioTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

async function decodeAudioPeaks(src: string): Promise<number[] | null> {
    try {
        const buffer = await (await fetch(src)).arrayBuffer();
        const context = (sharedContext ??= new AudioContext());
        const audio = await context.decodeAudioData(buffer);
        const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
        const peaks = Array.from({ length: AUDIO_WAVEFORM_BARS }, (_, bar) => {
            const start = Math.floor((bar * audio.length) / AUDIO_WAVEFORM_BARS);
            const end = Math.floor(((bar + 1) * audio.length) / AUDIO_WAVEFORM_BARS);
            let peak = 0;
            for (let sample = start; sample < end; sample += 1) {
                for (const channel of channels) peak = Math.max(peak, Math.abs(channel[sample]));
            }
            return peak;
        });
        const max = Math.max(...peaks);
        return max > 0 ? peaks.map((peak) => peak / max) : peaks;
    } catch {
        return null;
    }
}

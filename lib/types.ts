export type Notes = { summary: string; decisions: string[]; tasks: string[]; questions: string[] };
export type Meeting = { id: string; name: string; createdAt: string; status: 'processing' | 'done' | 'error'; source?: 'manual' | 'cloud' | 'yandex'; cloudId?: string; stage?: 'fetching' | 'transcribing' | 'analyzing'; transcript?: string; notes?: Notes; error?: string };
export const MAX_BYTES = 200 * 1024 * 1024;
export function validVideo(name: string, size: number) { return /\.(mp4|webm)$/i.test(name) && size > 0 && size <= MAX_BYTES; }

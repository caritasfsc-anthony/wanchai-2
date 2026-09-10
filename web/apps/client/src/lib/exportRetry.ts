export function retryableExportError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /暫時沒有回應|未能連接同步|未收到此項|網絡|network|offline|unavailable|deadline-exceeded|resource-exhausted|Failed to fetch|繁忙|正在處理另一批|too many times|Service unavailable/i.test(text);
}
export type ExportRetryOptions = { enabled?: () => boolean; signal?: AbortSignal; onRetry?: (message: string) => void };
export function checkExportStopped(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("匯出已停止。已確認寫入的資料會保留，再次送出可續傳。");
}
export function retryDelay(ms: number, signal?: AbortSignal): Promise<void> {
  checkExportStopped(signal);
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new Error("匯出已停止。")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function withExportRetry<T>(operation: () => Promise<T>, options: ExportRetryOptions = {}, delay = retryDelay): Promise<T> {
  let attempt = 0;
  while (true) {
    checkExportStopped(options.signal);
    try { const result = await operation(); options.onRetry?.(""); return result; }
    catch (error) {
      checkExportStopped(options.signal);
      if (!options.enabled?.() || !retryableExportError(error)) throw error;
      attempt += 1;
      const seconds = Math.min(30, 3 * 2 ** Math.min(attempt - 1, 4));
      options.onRetry?.(`連線中斷或服務繁忙，${seconds} 秒後第 ${attempt} 次重試。已確認的進度會保留。`);
      await delay(seconds * 1000, options.signal);
      if (!options.enabled?.()) throw error;
    }
  }
}

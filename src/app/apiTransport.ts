// One retry layer remains in PostgREST; transport never retries mutations.
export function createApiFetch(
  fetcher: typeof fetch = fetch,
  limit = 6,
  timeoutMs = 15000,
): typeof fetch {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async (input, init) => {
    const controller = new AbortController();
    const upstream =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(upstream?.reason);
    upstream?.addEventListener("abort", abort, { once: true });
    if (upstream?.aborted) abort();
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException("API request timed out", "TimeoutError"),
        ),
      timeoutMs,
    );
    let acquired = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const signal = controller.signal;
        const cancel = () => { const index = waiting.indexOf(start); if (index >= 0) waiting.splice(index,1); reject(signal.reason); };
        const start = () => { signal.removeEventListener("abort",cancel); active++; acquired = true; resolve(); };
        if (signal.aborted) { reject(signal.reason); return; }
        if (active < limit) start();
        else { waiting.push(start); signal.addEventListener("abort",cancel,{once:true}); }
      });
      return await fetcher(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener("abort", abort);
      if (acquired) { active--; waiting.shift()?.(); }
    }
  };
}

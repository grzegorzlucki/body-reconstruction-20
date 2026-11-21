type Entry = {
  value?: unknown;
  expires: number;
  pending?: Promise<unknown>;
  generation: number;
  controller: AbortController;
};
const entries = new Map<string, Entry>();
let epoch = 0;
export function clearResourceCache() {
  epoch++;
  for (const entry of entries.values()) entry.controller.abort();
  entries.clear();
}
export async function cachedResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  ttl = 30000,
): Promise<T> {
  const existing = entries.get(key);
  if (existing?.pending) return structuredClone(await existing.pending) as T;
  if (existing && existing.expires > Date.now())
    return structuredClone(existing.value) as T;
  const generation = epoch;
  const entry: Entry = {
    expires: 0,
    generation,
    controller: new AbortController(),
  };
  const timeout = setTimeout(
    () =>
      entry.controller.abort(
        new DOMException("Data loading timed out", "TimeoutError"),
      ),
    14000,
  );
  const pending = load(entry.controller.signal)
    .then((value) => {
      if (epoch !== generation || entries.get(key) !== entry)
        throw Error("Data changed during loading. Please retry.");
      entry.value = structuredClone(value);
      entry.expires = Date.now() + ttl;
      return value;
    })
    .finally(() => {
      clearTimeout(timeout);
      if (entries.get(key) === entry) {
        entry.pending = undefined;
        if (!entry.expires) entries.delete(key);
      }
    });
  entry.pending = pending;
  entries.set(key, entry);
  return structuredClone(await pending);
}
export function invalidateResource(key: string) {
  entries.get(key)?.controller.abort();
  entries.delete(key);
}
export function invalidateResources(prefix: string) {
  for (const key of entries.keys())
    if (key.startsWith(prefix)) invalidateResource(key);
}
export function patchResource<T>(key: string, update: (value: T) => T) {
  const entry = entries.get(key);
  if (!entry || entry.pending || entry.value === undefined) {
    invalidateResource(key);
    return;
  }
  entry.value = structuredClone(update(structuredClone(entry.value) as T));
}

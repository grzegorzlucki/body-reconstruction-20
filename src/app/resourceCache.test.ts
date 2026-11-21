import { afterEach, expect, it, vi } from "vitest";
import {
  cachedResource,
  clearResourceCache,
  invalidateResource,
  patchResource,
} from "./resourceCache";
afterEach(() => {
  clearResourceCache();
  vi.useRealTimers();
});
it("deduplicates parallel reads and returns isolated copies", async () => {
  const load = vi.fn(async () => [{ id: "a" }]);
  const [a, b] = await Promise.all([
    cachedResource("one", load),
    cachedResource("one", load),
  ]);
  a[0].id = "mutated";
  expect(b[0].id).toBe("a");
  expect(load).toHaveBeenCalledTimes(1);
  expect(await cachedResource("one", load)).toEqual([{ id: "a" }]);
});
it("expires data, does not cache errors and isolates resource keys", async () => {
  vi.useFakeTimers();
  const load = vi.fn(async () => 1);
  await cachedResource("a", load, 10);
  await cachedResource("b", load, 10);
  vi.advanceTimersByTime(11);
  await cachedResource("a", load, 10);
  expect(load).toHaveBeenCalledTimes(3);
  const failed = vi
    .fn()
    .mockRejectedValueOnce(Error("network"))
    .mockResolvedValueOnce(2);
  await expect(cachedResource("failed", failed)).rejects.toThrow("network");
  expect(await cachedResource("failed", failed)).toBe(2);
});
it("rejects a late read after logout or invalidation instead of repopulating private cache", async () => {
  let complete!: (value: number[]) => void;
  const pending = cachedResource(
    "private",
    () =>
      new Promise<number[]>((resolve) => {
        complete = resolve;
      }),
  );
  clearResourceCache();
  complete([1]);
  await expect(pending).rejects.toThrow("Data changed");
  expect(await cachedResource("private", async () => [2])).toEqual([2]);
});
it("patches only an existing confirmed resource and invalidates in-flight snapshots", async () => {
  await cachedResource("a", async () => [1]);
  patchResource<number[]>("a", (old) => [...old, 2]);
  expect(await cachedResource("a", async () => [3])).toEqual([1, 2]);
  invalidateResource("a");
  expect(await cachedResource("a", async () => [3])).toEqual([3]);
});

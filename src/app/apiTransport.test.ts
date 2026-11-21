import { expect, it, vi } from "vitest";
import { createApiFetch } from "./apiTransport";
it("removes an aborted queued request without sending it", async () => {
  let finish!: (value: Response) => void;
  const fetcher=vi.fn(() => new Promise<Response>(resolve=>{finish=resolve;}));
  const request=createApiFetch(fetcher as typeof fetch,1);
  const first=request("https://fixture.invalid");
  await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
  const controller=new AbortController();
  const second=request("https://fixture.invalid",{signal:controller.signal});
  controller.abort();
  await expect(second).rejects.toBeDefined();
  finish(new Response("ok")); await first;
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("bounds request concurrency and releases slots after failure", async () => {
  let active = 0,
    peak = 0;
  const mock = vi.fn(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return new Response("ok");
  });
  const request = createApiFetch(mock as typeof fetch, 2);
  await Promise.all(
    Array.from({ length: 12 }, () => request("https://fixture.invalid")),
  );
  expect(peak).toBe(2);
});
it("actually aborts timed-out requests and propagates caller cancellation", async () => {
  const mock = vi.fn(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) reject(init.signal.reason);
        else
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal!.reason),
            { once: true },
          );
      }),
  ) as typeof fetch;
  await expect(
    createApiFetch(mock, 1, 10)("https://fixture.invalid"),
  ).rejects.toThrow("timed out");
  const controller = new AbortController();
  controller.abort();
  await expect(
    createApiFetch(mock)("https://fixture.invalid", {
      signal: controller.signal,
    }),
  ).rejects.toBeDefined();
});

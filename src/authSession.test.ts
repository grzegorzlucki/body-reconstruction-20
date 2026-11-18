import { afterEach, describe, expect, it, vi } from "vitest";
import { watchAuthSession } from "./app/watchAuthSession";

function source() {
  let resolve!: (result: {
    data: { session: string | null };
    error: unknown;
  }) => void;
  let reject!: (cause: unknown) => void;
  const pending = new Promise<{
    data: { session: string | null };
    error: unknown;
  }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  let emit!: (event: string, session: string | null) => void;
  const unsubscribe = vi.fn(),
    onSession = vi.fn(),
    onError = vi.fn();
  const auth = {
    getSession: () => pending,
    onAuthStateChange: (callback: typeof emit) => {
      emit = callback;
      return { data: { subscription: { unsubscribe } } };
    },
  };
  const stop = watchAuthSession(auth, onSession, onError);
  return {
    resolve,
    reject,
    emit: (event: string, session: string | null) => emit(event, session),
    stop,
    unsubscribe,
    onSession,
    onError,
  };
}
afterEach(() => vi.useRealTimers());
describe("authentication startup lifecycle", () => {
  it("resolves a signed-out session without an error", async () => {
    const state = source();
    state.resolve({ data: { session: null }, error: null });
    await Promise.resolve();
    expect(state.onSession).toHaveBeenCalledWith(null);
    expect(state.onError).not.toHaveBeenCalled();
    state.stop();
  });
  it("reports rejection and allows a fresh watcher to retry", async () => {
    const state = source();
    state.reject(Error("Offline"));
    await Promise.resolve();
    await Promise.resolve();
    expect(state.onError).toHaveBeenCalledTimes(1);
    state.stop();
    const retry = source();
    retry.resolve({ data: { session: "valid" }, error: null });
    await Promise.resolve();
    expect(retry.onSession).toHaveBeenCalledWith("valid");
    retry.stop();
  });
  it("times out and ignores late startup results but accepts subsequent auth recovery", async () => {
    vi.useFakeTimers();
    const state = source();
    await vi.advanceTimersByTimeAsync(15000);
    expect(state.onError).toHaveBeenCalledTimes(1);
    state.resolve({ data: { session: "stale" }, error: null });
    await Promise.resolve();
    expect(state.onSession).not.toHaveBeenCalled();
    state.emit("SIGNED_IN", "current");
    expect(state.onSession).toHaveBeenCalledWith("current", "SIGNED_IN");
    state.stop();
  });
  it("does not overwrite a password recovery event with a stale initial session", async () => {
    const state = source();
    state.emit("PASSWORD_RECOVERY", "recovering");
    state.resolve({ data: { session: null }, error: null });
    await Promise.resolve();
    expect(state.onSession).toHaveBeenCalledTimes(1);
    expect(state.onSession).toHaveBeenCalledWith(
      "recovering",
      "PASSWORD_RECOVERY",
    );
    state.stop();
  });
  it("unsubscribes and suppresses all callbacks after unmount", async () => {
    vi.useFakeTimers();
    const state = source();
    state.stop();
    state.emit("SIGNED_OUT", null);
    state.resolve({ data: { session: "late" }, error: null });
    await vi.advanceTimersByTimeAsync(15000);
    expect(state.unsubscribe).toHaveBeenCalledTimes(1);
    expect(state.onSession).not.toHaveBeenCalled();
    expect(state.onError).not.toHaveBeenCalled();
  });
});

import { beforeEach, expect, it, vi } from "vitest";
const { rpc, from, update, eq, select, single } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("../supabase", () => ({ supabase: { rpc, from } }));
vi.mock("../db", () => ({ db: {} }));
import { saveAccountLanguage } from "../account/accountRepository";
import { readCachedPreference } from "./config";
beforeEach(() => {
  vi.clearAllMocks();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value) });
  from.mockReturnValue({ update }); update.mockReturnValue({ eq });
  eq.mockReturnValue({ select }); select.mockReturnValue({ single });
});

it("uses an RLS-protected field update when the language RPC is not deployed", async () => {
  rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } });
  single.mockResolvedValueOnce({ data: { id: "legacy", preferred_language: "en" }, error: null });
  await saveAccountLanguage("legacy", "en");
  expect(update).toHaveBeenCalledWith({ preferred_language: "en" });
  expect(eq).toHaveBeenCalledWith("id", "legacy");
});

it("does not bypass a permission denial or report an empty update as saved", async () => {
  rpc.mockResolvedValueOnce({ error: { code: "42501" } });
  await expect(saveAccountLanguage("denied", "en")).rejects.toEqual({ code: "42501" });
  expect(from).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } });
  single.mockResolvedValueOnce({ data: null, error: null });
  await expect(saveAccountLanguage("missing", "en")).rejects.toThrow("Profile unavailable");
});

it("serialises language writes across callers and continues after an RPC failure", async () => {
  let finishFirst!: (result: { error: { message: string } }) => void;
  rpc
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockResolvedValueOnce({ error: null });
  const first = saveAccountLanguage("profile-a", "en").catch((error) => error);
  const second = saveAccountLanguage("profile-a", "pl");
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
  expect(rpc).toHaveBeenNthCalledWith(1, "update_profile_language", {
    target_profile_id: "profile-a",
    language_preference: "en",
  });
  finishFirst({ error: { message: "denied" } });
  expect(await first).toEqual({ message: "denied" });
  await second;
  expect(readCachedPreference("profile-a")).toEqual({ value: "pl", pending: false });
  expect(rpc).toHaveBeenNthCalledWith(2, "update_profile_language", {
    target_profile_id: "profile-a",
    language_preference: "pl",
  });
  await expect(
    saveAccountLanguage("profile-a", "invalid" as "pl"),
  ).rejects.toThrow("Invalid language preference");
  expect(rpc).toHaveBeenCalledTimes(2);
});

it("keeps the latest selection pending until its own write finishes", async () => {
  let finish!: (value: { error: null }) => void;
  rpc.mockResolvedValueOnce({ error: null }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = saveAccountLanguage("queued", "en");
  const second = saveAccountLanguage("queued", "pl");
  await first;
  await vi.waitFor(() => expect(finish).toBeDefined());
  expect(readCachedPreference("queued")).toEqual({ value: "pl", pending: true });
  finish({ error: null });
  await second;
  expect(readCachedPreference("queued")).toEqual({ value: "pl", pending: false });
});

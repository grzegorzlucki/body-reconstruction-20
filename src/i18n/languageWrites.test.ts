import { expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../supabase", () => ({ supabase: { rpc } }));
vi.mock("../db", () => ({ db: {} }));
import { saveAccountLanguage } from "../account/accountRepository";

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
  expect(rpc).toHaveBeenNthCalledWith(2, "update_profile_language", {
    target_profile_id: "profile-a",
    language_preference: "pl",
  });
  await expect(
    saveAccountLanguage("profile-a", "invalid" as "pl"),
  ).rejects.toThrow("Invalid language preference");
  expect(rpc).toHaveBeenCalledTimes(2);
});

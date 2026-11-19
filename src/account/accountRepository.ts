import { isPreference, type LanguagePreference } from "../i18n/config";
import { supabase } from "../supabase";
import { db } from "../db";
import { accountIdentitySchema } from "../domain";

export async function saveAccountIdentity(profileId: string, raw: { name: string; timeZone: string }, avatarPath: string | null) {
  const identity = accountIdentitySchema.parse(raw);
  if (!supabase) {
    await db.profiles.update(profileId, { ...identity });
    return;
  }
  const { error } = await supabase.rpc("update_account_identity", {
    display_name: identity.name, account_time_zone: identity.timeZone, new_avatar_path: avatarPath,
  });
  if (error?.code === "PGRST202") throw Error("Zastosuj migrację 20261119_account_profile.sql w Supabase SQL Editor.");
  if (error) throw error;
}

export async function uploadAvatar(file: File, userId: string) {
  if (!supabase) throw Error("Zdjęcie jest dostępne dla konta w chmurze.");
  if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Wybierz JPEG, PNG lub WebP do 2 MB.");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Nie można przygotować zdjęcia.");
    const size = Math.min(image.width, image.height);
    context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) =>
      result ? resolve(result) : reject(Error("Nie można przygotować zdjęcia.")), "image/webp", .85));
    const path = `${userId}/${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: false });
    if (error) throw error;
    return path;
  } finally { image.close(); }
}

export async function removeAvatar(path: string) {
  if (!supabase) return;
  const { error } = await supabase.storage.from("avatars").remove([path]);
  if (error) throw error;
}

export const accountRedirect = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;

const languageWrites = new Map<string, Promise<unknown>>();
export async function saveAccountLanguage(profileId: string, preference: LanguagePreference) {
  if (!isPreference(preference)) throw Error("Invalid language preference");
  if (!supabase) { await db.profiles.update(profileId, { preferredLanguage: preference }); return; }
  const write = (languageWrites.get(profileId) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const { error } = await supabase!.rpc("update_profile_language", { target_profile_id: profileId, language_preference: preference });
    if (error) throw error;
  });
  languageWrites.set(profileId, write);
  try { await write; } finally { if (languageWrites.get(profileId) === write) languageWrites.delete(profileId); }
}

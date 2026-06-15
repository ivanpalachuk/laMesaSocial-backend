import type { users } from "../db/schema";
import { parseGamerDna, serializeGamerDna } from "../constants/product-categories";

export const AVATAR_PRESET_IDS = [
  "avatar-man-teal-hoodie",
  "avatar-man-coral-blazer",
  "avatar-woman-red-die",
  "avatar-woman-blonde-teal",
  "avatar-man-glasses-orange",
  "avatar-robot-white-orange",
  "avatar-robot-orange-gear",
  "avatar-woman-bob-meeple",
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

export { parseGamerDna, serializeGamerDna };
export type { ProductoCategory as GamerDnaOption } from "../constants/product-categories";

export function isAvatarPresetId(value: string): value is AvatarPresetId {
  return (AVATAR_PRESET_IDS as readonly string[]).includes(value);
}

export function buildAvatarUrl(origin: string, avatarImageKey: string | null) {
  if (!avatarImageKey) return null;
  const encoded = avatarImageKey.split("/").map(encodeURIComponent).join("/");
  return `${origin}/api/images/${encoded}`;
}

export function parseAvatarImageKeys(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.startsWith("avatars/"));
  } catch {
    return [];
  }
}

export function serializeAvatarImageKeys(keys: string[]): string {
  return JSON.stringify(keys);
}

export function appendAvatarImageKey(keys: string[], key: string, maxItems = 12): string[] {
  const filtered = keys.filter((item) => item !== key);
  return [key, ...filtered].slice(0, maxItems);
}

export function isUserScopedAvatarKey(userId: string, key: string): boolean {
  return key.startsWith(`avatars/${userId}/`);
}

export async function isAvatarKeyOwnedByUser(
  bucket: R2Bucket,
  userId: string,
  key: string,
): Promise<boolean> {
  if (!key.startsWith("avatars/")) return false;
  if (isUserScopedAvatarKey(userId, key)) return true;

  const head = await bucket.head(key);
  return head?.customMetadata?.uploadedBy === userId;
}

export async function filterOwnedAvatarKeys(
  bucket: R2Bucket,
  userId: string,
  keys: string[],
): Promise<string[]> {
  const owned: string[] = [];

  for (const key of keys) {
    if (await isAvatarKeyOwnedByUser(bucket, userId, key)) {
      owned.push(key);
    }
  }

  return owned;
}

export function collectAvatarHistoryKeys(user: {
  avatarImageKey: string | null;
  avatarImageKeys: string | null;
}): string[] {
  const stored = parseAvatarImageKeys(user.avatarImageKeys);
  if (user.avatarImageKey && !stored.includes(user.avatarImageKey)) {
    return appendAvatarImageKey(stored, user.avatarImageKey);
  }
  return stored;
}

export async function serializeUserProfile(
  origin: string,
  user: typeof users.$inferSelect,
  images?: R2Bucket,
) {
  const { password: _pw, gamerDna: rawGamerDna, ...rest } = user;
  void _pw;

  let avatarImageKeys = collectAvatarHistoryKeys(user);
  if (images) {
    avatarImageKeys = await filterOwnedAvatarKeys(images, user.id, avatarImageKeys);
  }

  const activeAvatarImageKey =
    user.avatarImageKey && avatarImageKeys.includes(user.avatarImageKey)
      ? user.avatarImageKey
      : null;

  const avatarHistoryUrls = avatarImageKeys
    .map((key) => ({
      key,
      url: buildAvatarUrl(origin, key),
    }))
    .filter((item): item is { key: string; url: string } => Boolean(item.url));

  return {
    id: rest.id,
    email: rest.email,
    name: rest.name,
    role: rest.role,
    isActive: rest.isActive,
    avatarImageKey: activeAvatarImageKey,
    avatarImageKeys,
    avatarHistoryUrls,
    avatarPreset: rest.avatarPreset,
    bio: rest.bio,
    gamerDna: parseGamerDna(rawGamerDna),
    discoveryZone: rest.discoveryZone,
    notifyEvents: rest.notifyEvents,
    notifyGroupInvites: rest.notifyGroupInvites,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
    avatarUrl: rest.avatarPreset ? null : buildAvatarUrl(origin, activeAvatarImageKey),
  };
}

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

export function serializeUserProfile(origin: string, user: typeof users.$inferSelect) {
  const { password: _pw, gamerDna: rawGamerDna, ...rest } = user;
  void _pw;

  return {
    id: rest.id,
    email: rest.email,
    name: rest.name,
    role: rest.role,
    isActive: rest.isActive,
    avatarImageKey: rest.avatarImageKey,
    avatarPreset: rest.avatarPreset,
    bio: rest.bio,
    gamerDna: parseGamerDna(rawGamerDna),
    discoveryZone: rest.discoveryZone,
    notifyEvents: rest.notifyEvents,
    notifyGroupInvites: rest.notifyGroupInvites,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
    avatarUrl: buildAvatarUrl(origin, user.avatarImageKey),
  };
}

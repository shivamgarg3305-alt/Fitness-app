/**
 * Public client config for VitaCore.
 * These EXPO_PUBLIC values are safe to ship in the app bundle (RLS protects data).
 * Never put GEMINI_API_KEY, Google client secret, or Supabase service-role keys here.
 *
 * Local `.env` overrides these defaults when present.
 */
export const publicSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || "https://offtlxnmbeobzaguclip.supabase.co";

export const publicSupabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "sb_publishable_oyDnTbmBYFGzt5ZNd0KmPA_d_r4q9ld";

/** Optional MapLibre style. Empty = GPS outline only. */
export const publicMapTileStyleUrl = process.env.EXPO_PUBLIC_MAP_TILE_STYLE_URL?.trim() || "";

import { supabase } from "@/integrations/supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Extract the storage path (e.g. "uid/avatar.png") from either a stored path
 * or a full Supabase public/signed URL kept for backwards compatibility.
 */
function extractPath(value: string): string | null {
  if (!value) return null;
  // Already a bare path like "uid/avatar.png"
  if (!/^https?:\/\//i.test(value)) {
    return value.split("?")[0];
  }
  // Full URL — try to find the segment after "/avatars/"
  const idx = value.indexOf("/avatars/");
  if (idx === -1) return null;
  return value.substring(idx + "/avatars/".length).split("?")[0];
}

/**
 * Resolve a stored avatar reference to a short-lived signed URL.
 * Returns null when no avatar is set or signing fails.
 */
export async function resolveAvatarUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const path = extractPath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn("[resolveAvatarUrl] failed to sign avatar url", error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Resolve many avatar references in parallel.
 */
export async function resolveAvatarUrls(
  stored: Array<string | null | undefined>,
): Promise<Array<string | null>> {
  return Promise.all(stored.map((v) => resolveAvatarUrl(v)));
}
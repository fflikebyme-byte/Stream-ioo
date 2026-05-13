/**
 * Extract the actual embeddable src from an embed_url field.
 * Supports raw iframe HTML or plain URLs.
 */
export function extractEmbedSrc(embedUrl: string | null | undefined): string {
  if (!embedUrl) return "";
  const trimmed = embedUrl.trim();
  // If it looks like HTML, try to extract src="..."
  if (trimmed.startsWith("<")) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    return match ? match[1] : "";
  }
  return trimmed;
}

/** Returns true if the URL points to a direct video file. */
export function isDirectVideo(url: string): boolean {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v|mkv|avi|m3u8)$/.test(p);
  } catch {
    return /\.(mp4|webm|ogg|mov|m4v|mkv|avi|m3u8)(\?|$)/i.test(url);
  }
}

/** Format view count nicely, e.g. 1234 → "1.2K". */
export function formatViews(count: number | null | undefined): string {
  if (!count && count !== 0) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

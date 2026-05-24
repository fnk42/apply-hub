import { getResumeBlob } from "@/lib/candidates.functions";

/**
 * Fetches the resume via a same-origin server function and opens it in a
 * new tab as a blob: URL. Avoids hitting supabase.co directly, which gets
 * ERR_BLOCKED_BY_CLIENT'd by ad blockers / privacy extensions.
 */
export async function openResumeInNewTab(path: string): Promise<void> {
  const { base64, contentType } = await getResumeBlob({ data: { path } });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener");
  // Revoke after a delay so the new tab has time to load the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!w) {
    // Popup blocked — fall back to navigating current tab.
    window.location.href = url;
  }
}

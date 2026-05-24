import { getResumeBlob } from "@/lib/candidates.functions";

/**
 * Fetches the resume via a same-origin server function and triggers a
 * download. We deliberately AVOID `window.open(blobUrl, "_blank")` because
 * Chrome extensions / enterprise policies frequently block navigation to
 * `blob:` URLs in a new tab with ERR_BLOCKED_BY_CLIENT. A synthetic
 * `<a download>` click is not subject to that block.
 */
export async function openResumeInNewTab(path: string): Promise<void> {
  const { base64, contentType, filename } = await getResumeBlob({
    data: { path },
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "resume";
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    // Last-resort fallback: same-tab navigation (not blocked by the
    // extensions that block blob-tab opens).
    window.location.href = url;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

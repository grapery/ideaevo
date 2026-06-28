import { api } from "@/lib/api-client";

/** 上传想法描述插图，返回可写入 Markdown 的公开 URL */
export async function uploadIdeaDescriptionImage(ideaId: string, file: File): Promise<string> {
  const presign = await api.presignIdeaAsset(ideaId, "content", file.type);
  const putRes = await fetch(presign.upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) {
    throw new Error("图片上传失败");
  }
  return presign.public_url;
}

export function markdownImageSnippet(url: string, alt = "配图"): string {
  return `\n\n![${alt}](${url})\n`;
}

export function insertAtTextareaCursor(
  text: string,
  snippet: string,
  textarea: HTMLTextAreaElement | null
): { next: string; cursor: number } {
  if (!textarea) {
    const next = text + snippet;
    return { next, cursor: next.length };
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = text.slice(0, start) + snippet + text.slice(end);
  const cursor = start + snippet.length;
  return { next, cursor };
}

export function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of data.items) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

export function imageFileFromDataTransfer(data: DataTransfer | null): File | null {
  if (!data?.files?.length) return null;
  const file = data.files[0];
  return file.type.startsWith("image/") ? file : null;
}

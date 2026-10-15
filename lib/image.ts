// Browser-side photo preparation: shrink large camera photos before upload so pages stay fast.

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Scales an image so its longest side is at most `maxSide`, and re-encodes it as JPEG */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.82): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image.`);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} couldn't be read. Try a JPEG or PNG.`);
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new Error(`${file.name} couldn't be processed.`);
  return { blob, width, height };
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

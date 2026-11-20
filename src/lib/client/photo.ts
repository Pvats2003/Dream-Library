"use client";

import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Square-crop from the centre and shrink to `size` px, as WebP. A phone photo
 * of 3–5 MB becomes ~40 KB, which uploads quickly on weak 4G.
 */
export async function squareImage(file: File, size = 512, crop = true): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  if (crop) {
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  } else {
    // ID proofs: keep the whole document, longest side = size.
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/webp", 0.82),
  );
}

/** Upload into the library's private folder. Returns the storage path. */
export async function uploadStudentFile(libraryId: string, blob: Blob, kind: "photo" | "id"): Promise<string> {
  const path = `${libraryId}/${kind}-${crypto.randomUUID()}.webp`;
  const { error } = await getBrowserClient().storage.from("student-files").upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}

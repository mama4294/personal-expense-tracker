import { z } from "zod";

/** Logos are stored inline, so keep them tiny: square, LOGO_SIZE px, WebP/PNG. */
export const LOGO_SIZE = 64;
const MAX_LOGO_LENGTH = 100_000;

export const logoSchema = z
  .string()
  .max(MAX_LOGO_LENGTH, "Logo image is too large.")
  .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG, JPEG, WebP or GIF image.");

/** Browser-only: center-crops and downsizes an image file to a small data URL. */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = LOGO_SIZE;
  canvas.height = LOGO_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read the image.");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    LOGO_SIZE,
    LOGO_SIZE,
  );
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

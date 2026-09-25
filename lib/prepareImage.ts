import imageCompression from "browser-image-compression";

const MAX_BYTES = 10 * 1024 * 1024;

// Converts iPhone HEIC, fixes orientation, resizes to 1536 px and strips EXIF (incl. GPS) by re-encoding.
export async function prepareImage(file: File): Promise<File> {
  if (file.size > MAX_BYTES * 3) throw new Error("That photo is too large. Please pick one under 30 MB.");
  let f = file;
  if (/heic|heif/i.test(file.type) || /\.hei(c|f)$/i.test(file.name)) {
    const heic2any = (await import("heic2any")).default;
    const blob = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })) as Blob;
    f = new File([blob], "room.jpg", { type: "image/jpeg" });
  }
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error("Please upload a JPG, PNG, WebP or HEIC photo.");
  return imageCompression(f, {
    maxWidthOrHeight: 1536,
    maxSizeMB: 2,
    fileType: "image/jpeg",
    useWebWorker: true,
    preserveExif: false,
  });
}

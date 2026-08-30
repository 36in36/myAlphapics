/**
 * Downscale an uploaded image before it goes into IndexedDB.
 *
 * Letter photos are small thumbnails (400px is plenty at their display size).
 * Count scenes need more: a parent taps individual faces in a group shot, so
 * the photo is shown large and 400px would be visibly soft.
 */
export function resizeImage(file: File, maxDim: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    };
    img.src = url;
  });
}

export const LETTER_PHOTO_MAX = 400;
export const SCENE_PHOTO_MAX = 1000;

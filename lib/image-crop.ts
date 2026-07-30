export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Bounding box of the source image after rotation, so the draw canvas is large enough to not clip corners. */
function rotatedSize(width: number, height: number, rotationDeg: number) {
  const rad = toRad(rotationDeg)
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  }
}

/**
 * Renders the source image rotated, then crops to `pixelCrop` (in rotated-image
 * space, as produced by react-easy-crop's onCropComplete). Mirrors the
 * library's documented canvas recipe.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotationDeg: number,
  mimeType: string,
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const { width: bBoxWidth, height: bBoxHeight } = rotatedSize(image.width, image.height, rotationDeg)

  const rotateCanvas = document.createElement('canvas')
  rotateCanvas.width = bBoxWidth
  rotateCanvas.height = bBoxHeight
  const rotateCtx = rotateCanvas.getContext('2d')
  if (!rotateCtx) throw new Error('Canvas not supported')

  rotateCtx.translate(bBoxWidth / 2, bBoxHeight / 2)
  rotateCtx.rotate(toRad(rotationDeg))
  rotateCtx.drawImage(image, -image.width / 2, -image.height / 2)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = pixelCrop.width
  outCanvas.height = pixelCrop.height
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) throw new Error('Canvas not supported')

  outCtx.drawImage(
    rotateCanvas,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  )

  return new Promise((resolve, reject) => {
    outCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Crop failed'))), mimeType, quality)
  })
}

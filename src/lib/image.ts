export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const max = 960
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await canvasToJpeg(canvas, 0.86)
  return blob
}

export async function cropImage(
  src: string,
  area: { x: number; y: number; width: number; height: number },
  max = 960,
): Promise<Blob> {
  const image = await loadImage(src)
  const scale = Math.min(1, max / Math.max(area.width, area.height))
  const width = Math.max(1, Math.round(area.width * scale))
  const height = Math.max(1, Math.round(area.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height)
  let blob = await canvasToJpeg(canvas, 0.86)
  if (blob.size > 480_000 && max > 640) return cropImage(src, area, 640)
  if (blob.size > 480_000) blob = await canvasToJpeg(canvas, 0.72)
  return blob
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image'))
    image.src = src
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/jpeg', quality)
  })
}

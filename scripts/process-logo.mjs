import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const source =
  process.argv[2] ||
  '/home/ubuntu/.cursor/projects/workspace/uploads/c17896b0e9b5e606d2a82abf97976695befef465101ad9788c1eb3ed3d5d0558_611c.png'

const CREAM = { r: 246, g: 244, b: 239, alpha: 1 }

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = info.width
const h = info.height
const ch = info.channels

let minx = w
let miny = h
let maxx = 0
let maxy = 0
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const a = data[(y * w + x) * ch + 3]
    if (a > 24) {
      if (x < minx) minx = x
      if (y < miny) miny = y
      if (x > maxx) maxx = x
      if (y > maxy) maxy = y
    }
  }
}

const cx = (minx + maxx) / 2
const cy = (miny + maxy) / 2
const radius = Math.max(maxx - cx, cx - minx, maxy - cy, cy - miny)
const pad = 2
const left = Math.max(0, Math.floor(cx - radius - pad))
const top = Math.max(0, Math.floor(cy - radius - pad))
const right = Math.min(w - 1, Math.ceil(cx + radius + pad))
const bottom = Math.min(h - 1, Math.ceil(cy + radius + pad))
const side = Math.max(right - left + 1, bottom - top + 1)
const originX = Math.max(0, Math.min(w - side, Math.round(cx - side / 2)))
const originY = Math.max(0, Math.min(h - side, Math.round(cy - side / 2)))

const out = Buffer.alloc(side * side * 4)
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const sx = originX + x
    const sy = originY + y
    const oi = (y * side + x) * 4
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue
    const si = (sy * w + sx) * ch
    const dx = sx - cx
    const dy = sy - cy
    const dist = Math.hypot(dx, dy)
    let alpha = data[si + 3]
    if (dist > radius + 0.75) alpha = 0
    else if (dist < radius - 1.25 && alpha > 16) alpha = 255
    else alpha = alpha >= 250 ? 255 : alpha
    out[oi] = data[si]
    out[oi + 1] = data[si + 1]
    out[oi + 2] = data[si + 2]
    out[oi + 3] = alpha
  }
}

mkdirSync('public/icons', { recursive: true })
mkdirSync('src/app', { recursive: true })

const master = sharp(out, { raw: { width: side, height: side, channels: 4 } })
await master
  .clone()
  .resize(1024, 1024, { fit: 'fill' })
  .png({ compressionLevel: 9, effort: 10 })
  .toFile('public/logo.png')

async function icon(size, file, scale, background) {
  const inner = Math.round(size * scale)
  const rendered = await sharp('public/logo.png').resize(inner, inner).png().toBuffer()
  let pipeline = sharp({
    create: { width: size, height: size, channels: 4, background },
  }).composite([{ input: rendered, gravity: 'center' }])
  if (!String(file).endsWith('.png')) pipeline = pipeline.png()
  await pipeline.png().toFile(file)
}

await icon(192, 'public/icons/icon-192.png', 0.9, CREAM)
await icon(512, 'public/icons/icon-512.png', 0.9, CREAM)
await icon(512, 'public/icons/icon-maskable-512.png', 0.66, CREAM)
await icon(180, 'public/icons/apple-touch-icon.png', 0.86, CREAM)
await icon(32, 'src/app/icon.png', 0.9, CREAM)
await icon(180, 'src/app/apple-icon.png', 0.86, CREAM)

const logoMeta = await sharp('public/logo.png').metadata()
console.log(
  `Logo ${logoMeta.width}x${logoMeta.height}, circle r=${radius.toFixed(1)} center=${cx.toFixed(1)},${cy.toFixed(1)} crop=${side}`,
)
console.log('Zapisano public/logo.png, ikony PWA, favicon i apple-touch-icon')

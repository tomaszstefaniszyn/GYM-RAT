import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

mkdirSync('public/icons', { recursive: true })
const cream = { r: 246, g: 244, b: 239, alpha: 1 }

async function icon(size, file, scale) {
  const inner = Math.round(size * scale)
  const rendered = await sharp('public/logo.png').resize(inner, inner).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: cream },
  })
    .composite([{ input: rendered, gravity: 'center' }])
    .png()
    .toFile(file)
}

await icon(192, 'public/icons/icon-192.png', 0.9)
await icon(512, 'public/icons/icon-512.png', 0.9)
await icon(512, 'public/icons/icon-maskable-512.png', 0.66)
await icon(180, 'public/icons/apple-touch-icon.png', 0.86)
await icon(32, 'src/app/icon.png', 0.9)
await icon(180, 'src/app/apple-icon.png', 0.86)
console.log('Ikony zapisane w public/icons, src/app/icon.png i src/app/apple-icon.png')

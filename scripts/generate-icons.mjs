import { mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

mkdirSync('public/icons', { recursive: true })
const svg = readFileSync('public/logo.svg')

async function onWhite(size, file, innerScale = 1) {
  const inner = Math.round(size * innerScale)
  const rendered = await sharp(svg).resize(inner, inner).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: rendered, gravity: 'center' }])
    .png()
    .toFile(file)
}

await onWhite(192, 'public/icons/icon-192.png', 1)
await onWhite(512, 'public/icons/icon-512.png', 1)
await onWhite(512, 'public/icons/icon-maskable-512.png', 0.68)
await onWhite(180, 'public/icons/apple-touch-icon.png', 0.92)
console.log('Ikony zapisane w public/icons')

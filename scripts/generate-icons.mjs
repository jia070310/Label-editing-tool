/**
 * 用「关于」页同一套标记生成应用图标（PNG / ICO / favicon）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const buildDir = path.join(root, 'build')
const electronDir = path.join(root, 'electron')
const publicDir = path.join(root, 'public')

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512]
const MASTER = 1024

/** 与 AboutDialog / .about-mark 一致：圆角橙底 + 白色裁切标记 */
function appIconSvg(size) {
  const r = Math.round(size * 0.22)
  const stroke = Math.max(2, Math.round(size * (2 / 24)))
  // 将 viewBox 0..24 映射到内边距区域，留白约 18%
  const pad = size * 0.18
  const scale = (size - pad * 2) / 24
  const tx = pad
  const ty = pad
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff9a4a"/>
      <stop offset="55%" stop-color="#ff7a1a"/>
      <stop offset="100%" stop-color="#ef6c0c"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})"
     fill="none" stroke="#ffffff" stroke-width="${(stroke / scale).toFixed(3)}"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 7h10v10H7z"/>
    <path d="M3 7h4"/>
    <path d="M17 7h4"/>
    <path d="M7 3v4"/>
    <path d="M7 17v4"/>
  </g>
</svg>`
}

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff9a4a"/>
      <stop offset="55%" stop-color="#ff7a1a"/>
      <stop offset="100%" stop-color="#ef6c0c"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" ry="7" fill="url(#bg)"/>
  <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
     transform="translate(4 4) scale(1)">
    <path d="M7 7h10v10H7z"/>
    <path d="M3 7h4"/>
    <path d="M17 7h4"/>
    <path d="M7 3v4"/>
    <path d="M7 17v4"/>
  </g>
</svg>
`

async function main() {
  fs.mkdirSync(buildDir, { recursive: true })

  const masterSvg = Buffer.from(appIconSvg(MASTER))
  const masterPng = await sharp(masterSvg).png().toBuffer()
  fs.writeFileSync(path.join(buildDir, 'icon.png'), masterPng)

  const icoBuffers = []
  for (const size of SIZES) {
    const buf = await sharp(masterPng)
      .resize(size, size, { fit: 'fill' })
      .png()
      .toBuffer()
    fs.writeFileSync(path.join(buildDir, `icon-${size}.png`), buf)
    if ([16, 24, 32, 48, 64, 128, 256].includes(size)) {
      icoBuffers.push(buf)
    }
  }

  const ico = await pngToIco(icoBuffers)
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico)

  // Electron 运行时窗口图标
  fs.copyFileSync(path.join(buildDir, 'icon.ico'), path.join(electronDir, 'icon.ico'))
  fs.copyFileSync(path.join(buildDir, 'icon.png'), path.join(electronDir, 'icon.png'))

  // Web / 开发页 favicon
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg)
  await sharp(Buffer.from(appIconSvg(32)))
    .png()
    .toFile(path.join(publicDir, 'favicon.png'))

  console.log('Icons generated:')
  console.log(' - build/icon.png, build/icon.ico, build/icon-*.png')
  console.log(' - electron/icon.ico, electron/icon.png')
  console.log(' - public/favicon.svg, public/favicon.png')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
